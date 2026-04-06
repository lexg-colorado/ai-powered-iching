# AI-Powered I Ching

A complete I Ching divination system with CLI, interactive REPL, REST API, and Next.js web interface. Casts hexagrams via three-coin method (CSPRNG), retrieves interpretive passages from structured markdown files and Wing commentaries (with ChromaDB as an alternative), and synthesizes readings with a local LLM.

## Features

- **Three-coin casting** with cryptographically secure randomness (`secrets` / `crypto.getRandomValues()`)
- **Full hexagram analysis** — primary, relating (transformed), nuclear (Hu Gua), and complement (Zong Gua) hexagrams
- **LLM-synthesized readings** following traditional interpretation order (Judgment, changing lines, relating hexagram, nuclear, Zong Gua) with Wing commentaries (T'uan Chuan, Hsiang Chuan, Tsa Kua, Hsu Kua)
- **Two-layer text retrieval** — structured markdown files + Wing commentaries (primary), or ChromaDB embedding search (alternative)
- **Transformation engine** — XOR-based change mechanics in GF(2)^6, Hamming distance, neighbor search
- **Interactive REPL** with slash commands (`/cast`, `/transform`, `/xref`, `/query`, `/lookup`, and more)
- **REST API** (FastAPI) with streaming support for real-time reading generation
- **Next.js web UI** with manual/auto casting, streaming interpretation display, and collapsible sections

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** (for the web UI)
- **LM Studio** running locally at `http://localhost:1234/v1` with:
  - `qwen2.5-14b-instruct` (chat/synthesis)
  - `text-embedding-nomic-embed-text-v1.5` (embeddings)

## Installation

### Python CLI & API

```bash
git clone https://github.com/lexg-colorado/ai-powered-iching.git
cd ai-powered-iching

python -m venv venv
source venv/bin/activate
pip install -e .
```

### Web UI

```bash
cd Web
npm install
```

### Load Reference Data

Populate ChromaDB with I Ching reference texts (required for passage retrieval):

```bash
iching --load-reference
```

## Configuration

All configuration is via environment variables or a `.env` file (checked in cwd, then `~/.iching/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `LM_STUDIO_URL` | `http://localhost:1234/v1` | LM Studio endpoint |
| `LM_STUDIO_MODEL` | `qwen2.5-14b-instruct` | Chat model |
| `LM_STUDIO_SYNTHESIS_MODEL` | `qwen2.5-14b-instruct` | Reading synthesis model |
| `LM_STUDIO_EMBEDDING_MODEL` | `text-embedding-nomic-embed-text-v1.5` | Embedding model |
| `LM_STUDIO_MAX_TOKENS` | `2048` | Max output tokens (non-thinking models) |
| `LM_STUDIO_THINKING_MAX_TOKENS` | `8192` | Max output tokens (thinking models) |
| `CHROMA_PATH` | `~/.iching/chroma_data` | ChromaDB storage path |
| `DEFAULT_COLLECTION` | `iching_toc_test` | Default ChromaDB collection |

## Usage

### CLI

```bash
# Interactive REPL
iching

# Auto-cast with a question
iching -a -q "What should I focus on today?"

# Auto-cast (no question)
iching -a

# Look up hexagram text passages
iching --lookup 53
iching --lookup 53 --lines 2,5

# Show transformation path between hexagrams
iching --transform 1 2

# List ChromaDB collections
iching --collections
```

### REPL Commands

| Command | Description |
|---------|-------------|
| `/cast` | Cast a new hexagram reading |
| `/transform` | Show transformation between two hexagrams |
| `/xref` | Cross-reference hexagram relationships |
| `/query` | Query ChromaDB for passages |
| `/lookup` | Look up raw text for a hexagram |
| `/load-reference` | Load reference data into ChromaDB |
| `/collections` | List available collections |
| `/help` | Show all commands |
| `/quit` | Exit the REPL |

### API Server

```bash
# Start the FastAPI server
cd api
uvicorn server:app --reload --port 8000
```

Endpoints:
- `POST /api/cast` — Cast hexagram and get structured result
- `POST /api/reading` — Generate LLM interpretation (streaming SSE)
- `POST /api/reading/text-passages` — Retrieve raw text passages
- `GET /api/health` — Check LM Studio and ChromaDB connectivity
- `GET /api/collections` — List ChromaDB collections

### Web UI

```bash
cd Web
npm run dev
```

Opens at `http://localhost:3000`. Features manual line-by-line entry, coin casting animation, auto-cast, and streaming reading display with collapsible nuclear/Zong Gua sections.

## Architecture

```
iching/              Python package (CLI + core logic)
  cli.py             Entry point (argparse)
  app.py             REPL session + slash commands
  hexagram_lookup.py Core domain: lookups, casting, transformations, nuclear/complement
  hexagram_text.py   Structured passage retrieval from markdown + Wings files
  reading.py         LLM prompt construction + synthesis orchestration (conciseness-tuned)
  llm_client.py      Async OpenAI SDK wrapper (LM Studio)
  chromadb_client.py ChromaDB wrapper (query, store, collections)
  config.py          Environment config loader
  Data/              King Wen sequence JSON, 64 hexagram texts, 64+5 Wing commentaries

api/                 FastAPI REST server
  server.py          Endpoints with SSE streaming

Web/                 Next.js 14 frontend
  src/lib/           Client-side hexagram logic, types, API client
  src/components/    React components (casting, display, reading)
  src/hooks/         Custom hooks (hexagram builder state)
  src/app/           Next.js app router pages
```

### Hexagram System

Hexagrams are 6-bit vectors in GF(2)^6. Binary strings are MSB-first (index 0 = line 6/top). Transformations use XOR with change masks.

- **Primary** — the cast hexagram
- **Relating** — primary transformed by changing lines (old yin/yang flip)
- **Nuclear (Hu Gua)** — inner trigrams: lines 2-3-4 (lower), 3-4-5 (upper)
- **Zong Gua** — complement: every line inverted (bitwise NOT)

Coin values: Heads = 3, Tails = 2. Sums: 6 (old yin), 7 (young yang), 8 (young yin), 9 (old yang).

## License

[Apache License 2.0](LICENSE)
