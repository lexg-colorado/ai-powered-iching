#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# reset-iching.sh — Start/stop/restart the I Ching web app (backend + frontend)
# Usage: ./reset-iching.sh [start|stop|restart|status]  (default: restart)
# ============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT=8000
FRONTEND_PORT=3000
VENV_DIR="$PROJECT_ROOT/venv"
PIDFILE="$PROJECT_ROOT/.iching-pids"
LOG_DIR="$PROJECT_ROOT/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
HEALTH_ENDPOINT="http://localhost:$BACKEND_PORT/api/health"

# ---------------------------------------------------------------------------
# Color helpers (disabled when not a tty)
# ---------------------------------------------------------------------------
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
    CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi

info()  { printf "${GREEN}[OK]${RESET}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${RESET}  %s\n" "$*"; }
err()   { printf "${RED}[ERROR]${RESET} %s\n" "$*" >&2; }
step()  { printf "${CYAN}>>>${RESET}     %s\n" "$*"; }

# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

# Return PIDs listening on a given port (one per line)
port_pids() {
    local port="$1"
    if command -v lsof &>/dev/null; then
        lsof -ti :"$port" 2>/dev/null || true
    elif command -v ss &>/dev/null; then
        ss -tlnp "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' || true
    elif command -v fuser &>/dev/null; then
        fuser "$port/tcp" 2>/dev/null | tr -s ' ' '\n' || true
    fi
}

is_port_free() {
    [[ -z "$(port_pids "$1")" ]]
}

read_pidfile() {
    BACKEND_PID=""; FRONTEND_PID=""
    if [[ -f "$PIDFILE" ]]; then
        # shellcheck disable=SC1090
        source "$PIDFILE"
    fi
}

write_pidfile() {
    cat > "$PIDFILE" <<EOF
BACKEND_PID=$1
FRONTEND_PID=$2
EOF
}

remove_pidfile() {
    rm -f "$PIDFILE"
}

pid_alive() {
    kill -0 "$1" 2>/dev/null
}

# Load LM_STUDIO_URL from .env (if present) for the optional health check
load_lm_studio_url() {
    LM_STUDIO_URL="http://localhost:1234/v1"
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        local val
        val=$(grep -E '^LM_STUDIO_URL=' "$PROJECT_ROOT/.env" | cut -d= -f2- | tr -d '[:space:]') || true
        [[ -n "$val" ]] && LM_STUDIO_URL="$val"
    fi
}

# ---------------------------------------------------------------------------
# do_stop — aggressive four-phase shutdown
# ---------------------------------------------------------------------------
do_stop() {
    echo ""
    step "Stopping I Ching services..."

    local dirty=0

    # --- Phase 1: Graceful stop via saved PIDs ---
    read_pidfile
    for label_pid in "Backend:$BACKEND_PID" "Frontend:$FRONTEND_PID"; do
        local label="${label_pid%%:*}"
        local pid="${label_pid##*:}"
        if [[ -n "$pid" ]] && pid_alive "$pid"; then
            step "Sending SIGTERM to $label (PID $pid)"
            kill "$pid" 2>/dev/null || true
            dirty=1
        fi
    done
    if (( dirty )); then
        sleep 2
    fi

    # --- Phase 2: Kill by port ---
    for port in $BACKEND_PORT $FRONTEND_PORT; do
        local pids
        pids=$(port_pids "$port")
        if [[ -n "$pids" ]]; then
            warn "Port $port still in use — sending SIGTERM to: $(echo "$pids" | tr '\n' ' ')"
            echo "$pids" | xargs -r kill 2>/dev/null || true
            dirty=1
        fi
    done
    if (( dirty )); then
        sleep 2
    fi

    # --- Phase 3: Kill orphaned processes by name ---
    for pattern in "uvicorn server:app" "next-server" "next dev"; do
        pkill -f "$pattern" 2>/dev/null || true
    done
    sleep 1

    # --- Phase 4: SIGKILL survivors ---
    local survivors=0
    for port in $BACKEND_PORT $FRONTEND_PORT; do
        local pids
        pids=$(port_pids "$port")
        if [[ -n "$pids" ]]; then
            warn "Port $port STILL occupied — escalating to SIGKILL: $(echo "$pids" | tr '\n' ' ')"
            echo "$pids" | xargs -r kill -9 2>/dev/null || true
            survivors=1
        fi
    done
    for pattern in "uvicorn server:app" "next-server" "next dev"; do
        pkill -9 -f "$pattern" 2>/dev/null || true
    done
    if (( survivors )); then
        sleep 1
    fi

    # --- Final verification ---
    local failed=0
    for port in $BACKEND_PORT $FRONTEND_PORT; do
        local pids
        pids=$(port_pids "$port")
        if [[ -n "$pids" ]]; then
            err "Port $port still in use by PID(s): $(echo "$pids" | tr '\n' ' ')"
            failed=1
        fi
    done
    if (( failed )); then
        err "Could not free all ports. Check processes manually."
        exit 1
    fi

    remove_pidfile
    info "All services stopped. Ports $BACKEND_PORT and $FRONTEND_PORT are free."
    echo ""
}

# ---------------------------------------------------------------------------
# do_start — launch backend and frontend
# ---------------------------------------------------------------------------
do_start() {
    echo ""
    step "Starting I Ching services..."

    # Verify ports are free
    for port in $BACKEND_PORT $FRONTEND_PORT; do
        if ! is_port_free "$port"; then
            local pids
            pids=$(port_pids "$port")
            err "Port $port is occupied by PID(s): $(echo "$pids" | tr '\n' ' ')"
            err "Run '$0 stop' first."
            exit 1
        fi
    done

    # Check venv exists
    if [[ ! -f "$VENV_DIR/bin/activate" ]]; then
        err "Python venv not found at $VENV_DIR"
        err "Create it with: python -m venv venv && pip install -e ."
        exit 1
    fi

    # Check backend dependencies
    if ! "$VENV_DIR/bin/python" -c "import fastapi" 2>/dev/null; then
        err "Missing backend dependencies (fastapi not found)"
        err "Run: source venv/bin/activate && pip install -r api/requirements.txt"
        exit 1
    fi

    # Check frontend dependencies
    if [[ ! -d "$PROJECT_ROOT/Web/node_modules" ]]; then
        err "Frontend dependencies not installed"
        err "Run: cd Web && npm install"
        exit 1
    fi

    # Optional: check LM Studio connectivity
    load_lm_studio_url
    if curl -sf --max-time 3 "$LM_STUDIO_URL/models" &>/dev/null; then
        info "LM Studio reachable at $LM_STUDIO_URL"
    else
        warn "LM Studio not responding at $LM_STUDIO_URL (readings will fail until it's up)"
    fi

    # Create log directory
    mkdir -p "$LOG_DIR"

    # Start backend
    step "Starting backend (uvicorn on port $BACKEND_PORT)..."
    (
        # shellcheck disable=SC1091
        source "$VENV_DIR/bin/activate"
        cd "$PROJECT_ROOT/api"
        exec uvicorn server:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
    ) > "$BACKEND_LOG" 2>&1 &
    local backend_pid=$!

    # Start frontend
    step "Starting frontend (Next.js on port $FRONTEND_PORT)..."
    (
        cd "$PROJECT_ROOT/Web"
        exec npm run dev -- -H 0.0.0.0
    ) > "$FRONTEND_LOG" 2>&1 &
    local frontend_pid=$!

    write_pidfile "$backend_pid" "$frontend_pid"

    # Wait for backend health
    step "Waiting for backend to respond..."
    local attempts=0 max_attempts=8 backend_ok=0
    while (( attempts < max_attempts )); do
        if ! pid_alive "$backend_pid"; then
            err "Backend process died — check $BACKEND_LOG"
            break
        fi
        if curl -sf --max-time 2 "$HEALTH_ENDPOINT" &>/dev/null; then
            info "Backend is up (PID $backend_pid)"
            backend_ok=1
            break
        fi
        (( attempts++ )) || true
        sleep 2
    done
    if (( ! backend_ok && attempts >= max_attempts )); then
        warn "Backend did not respond within $((max_attempts * 2))s — check $BACKEND_LOG"
    fi

    # Wait for frontend
    step "Waiting for frontend to respond..."
    attempts=0
    local frontend_ok=0
    while (( attempts < max_attempts )); do
        if ! pid_alive "$frontend_pid"; then
            err "Frontend process died — check $FRONTEND_LOG"
            break
        fi
        if curl -sf --max-time 2 "http://localhost:$FRONTEND_PORT" &>/dev/null; then
            info "Frontend is up (PID $frontend_pid)"
            frontend_ok=1
            break
        fi
        (( attempts++ )) || true
        sleep 2
    done
    if (( ! frontend_ok && attempts >= max_attempts )); then
        warn "Frontend did not respond within $((max_attempts * 2))s — check $FRONTEND_LOG"
    fi

    # Summary
    echo ""
    printf "${BOLD}%-10s %-8s %s${RESET}\n" "SERVICE" "PORT" "PID"
    printf "%-10s %-8s %s\n" "Backend" "$BACKEND_PORT" "$backend_pid"
    printf "%-10s %-8s %s\n" "Frontend" "$FRONTEND_PORT" "$frontend_pid"
    echo ""
    info "Logs: $BACKEND_LOG"
    info "Logs: $FRONTEND_LOG"
    echo ""
}

# ---------------------------------------------------------------------------
# do_status — show current state
# ---------------------------------------------------------------------------
do_status() {
    echo ""
    read_pidfile

    for entry in "Backend:$BACKEND_PORT:$BACKEND_PID" "Frontend:$FRONTEND_PORT:$FRONTEND_PID"; do
        local label="${entry%%:*}"
        local rest="${entry#*:}"
        local port="${rest%%:*}"
        local saved_pid="${rest##*:}"
        local port_owners
        port_owners=$(port_pids "$port")

        if [[ -n "$saved_pid" ]] && pid_alive "$saved_pid"; then
            info "$label (port $port): ${BOLD}RUNNING${RESET}  PID $saved_pid"
        elif [[ -n "$port_owners" ]]; then
            warn "$label (port $port): ${BOLD}UNKNOWN${RESET}  port in use by PID(s) $(echo "$port_owners" | tr '\n' ' ') (not tracked)"
        else
            printf "${RED}[--]${RESET}    %s (port %s): ${BOLD}STOPPED${RESET}\n" "$label" "$port"
        fi
    done

    # Optional health endpoint detail
    if ! is_port_free "$BACKEND_PORT"; then
        local health
        if health=$(curl -sf --max-time 3 "$HEALTH_ENDPOINT" 2>/dev/null); then
            echo ""
            step "Health endpoint response:"
            if command -v jq &>/dev/null; then
                echo "$health" | jq .
            else
                echo "$health"
            fi
        fi
    fi
    echo ""
}

# ---------------------------------------------------------------------------
# Main dispatch
# ---------------------------------------------------------------------------
case "${1:-restart}" in
    start)   do_start ;;
    stop)    do_stop ;;
    restart) do_stop; do_start ;;
    status)  do_status ;;
    -h|--help|help)
        echo "Usage: $0 {start|stop|restart|status}"
        echo "  start    Start backend (port $BACKEND_PORT) and frontend (port $FRONTEND_PORT)"
        echo "  stop     Aggressively stop all services and free ports"
        echo "  restart  Stop then start (default when no argument given)"
        echo "  status   Show service status and health"
        ;;
    *)
        err "Unknown command: $1"
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
