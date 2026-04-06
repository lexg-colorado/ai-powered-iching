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
    """Query LM Studio's /v1/models and auto-configure active models.

    Returns a status dict on success, None if LM Studio is unreachable.
    """
    global _active_chat_model, _active_embedding_model, _active_synthesis_model

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(base_url=LM_STUDIO_URL, api_key="lm-studio")
        models = await client.models.list()
        model_ids = [m.id for m in models.data]
    except Exception:
        return None

    if not model_ids:
        return None

    embedding_models = [m for m in model_ids if "embed" in m.lower()]
    chat_models = [m for m in model_ids if "embed" not in m.lower()]

    if chat_models:
        _active_chat_model = chat_models[0]
        _active_synthesis_model = chat_models[0]

    if embedding_models:
        _active_embedding_model = embedding_models[0]

    return {
        "all_models": model_ids,
        "chat_model": get_chat_model(),
        "embedding_model": get_embedding_model(),
        "synthesis_model": get_synthesis_model(),
    }
