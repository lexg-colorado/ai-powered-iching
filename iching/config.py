import os
from dotenv import load_dotenv

load_dotenv()  # cwd .env (useful during development)
load_dotenv(os.path.expanduser("~/.iching/.env"))  # user config fallback

LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1")
LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "qwen2.5-14b-instruct")
LM_STUDIO_EMBEDDING_MODEL = os.getenv("LM_STUDIO_EMBEDDING_MODEL", "text-embedding-nomic-embed-text-v1.5")
LM_STUDIO_SYNTHESIS_MODEL = os.getenv("LM_STUDIO_SYNTHESIS_MODEL", "qwen2.5-14b-instruct")
CHROMA_PATH = os.getenv("CHROMA_PATH", os.path.expanduser("~/.iching/chroma_data"))
if not os.path.isabs(CHROMA_PATH):
    _project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    CHROMA_PATH = os.path.join(_project_root, CHROMA_PATH)
DEFAULT_COLLECTION = os.getenv("DEFAULT_COLLECTION", "iching_toc_test")

# Token budgets — thinking models need much more headroom
MAX_TOKENS = int(os.getenv("LM_STUDIO_MAX_TOKENS", "2048"))
THINKING_MAX_TOKENS = int(os.getenv("LM_STUDIO_THINKING_MAX_TOKENS", "8192"))

# Known thinking model name patterns
_THINKING_PATTERNS = ("qwen3", "deepseek-r1", "deepseek-reasoner")


def is_thinking_model(model_name: str | None = None) -> bool:
    """Check if a model name matches known thinking model patterns."""
    name = (model_name or get_synthesis_model()).lower()
    return any(p in name for p in _THINKING_PATTERNS)


def get_max_tokens(model: str | None = None) -> int:
    """Return the appropriate max_tokens for the given model."""
    return THINKING_MAX_TOKENS if is_thinking_model(model) else MAX_TOKENS


# Auto-detected model overrides (set at runtime by detect_and_configure())
_active_chat_model: str | None = None
_active_embedding_model: str | None = None
_active_synthesis_model: str | None = None


def get_chat_model() -> str:
    return _active_chat_model or LM_STUDIO_MODEL


def get_embedding_model() -> str:
    return _active_embedding_model or LM_STUDIO_EMBEDDING_MODEL


def get_synthesis_model() -> str:
    return _active_synthesis_model or LM_STUDIO_SYNTHESIS_MODEL


async def detect_and_configure() -> dict | None:
    """Query LM Studio and auto-configure active models.

    Prefers LM Studio's native /api/v0/models (which exposes load state and
    model type) so we pick a model that is actually loaded and is a plain
    LLM — vision-language and unloaded models often fail JIT-load. Falls
    back to OpenAI-compat /v1/models if the native endpoint is unavailable.

    Returns a status dict on success, None if LM Studio is unreachable.
    """
    global _active_chat_model, _active_embedding_model, _active_synthesis_model

    import httpx

    base = LM_STUDIO_URL.rstrip("/").removesuffix("/v1")
    chat_pick: str | None = None
    embed_pick: str | None = None
    model_ids: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            resp = await http.get(f"{base}/api/v0/models")
            if resp.status_code == 200:
                entries = resp.json().get("data", [])
                model_ids = [e["id"] for e in entries]
                # Plain LLMs only — exclude vision-language models (vlm)
                # since they often fail JIT-load and don't fit the reading
                # synthesis prompt shape. Prefer loaded models first.
                chat_candidates = [e for e in entries if e.get("type") == "llm"]
                chat_candidates.sort(key=lambda e: 0 if e.get("state") == "loaded" else 1)
                if chat_candidates:
                    chat_pick = chat_candidates[0]["id"]
                embed_candidates = [e for e in entries if e.get("type") == "embeddings"]
                embed_candidates.sort(key=lambda e: 0 if e.get("state") == "loaded" else 1)
                if embed_candidates:
                    embed_pick = embed_candidates[0]["id"]
    except Exception:
        pass

    if chat_pick is None:
        # Fall back to OpenAI-compat listing (no state info — best-effort)
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(base_url=LM_STUDIO_URL, api_key="lm-studio")
            models = await client.models.list()
            model_ids = [m.id for m in models.data]
        except Exception:
            return None
        if not model_ids:
            return None
        # Filter out non-LLM model types we can detect by name pattern.
        _bad = ("embed", "whisper", "-vl-", "-vlm", "vision")
        embed_pick = next((m for m in model_ids if "embed" in m.lower()), None)
        chat_pick = next(
            (m for m in model_ids if not any(b in m.lower() for b in _bad)),
            None,
        )

    if chat_pick:
        _active_chat_model = chat_pick
        _active_synthesis_model = chat_pick
    if embed_pick:
        _active_embedding_model = embed_pick

    return {
        "all_models": model_ids,
        "chat_model": get_chat_model(),
        "embedding_model": get_embedding_model(),
        "synthesis_model": get_synthesis_model(),
    }
