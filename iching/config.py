import os
from dotenv import load_dotenv

load_dotenv()  # cwd .env (useful during development)
load_dotenv(os.path.expanduser("~/.iching/.env"))  # user config fallback

LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1")
LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "qwen2.5-14b-instruct-mlx")
LM_STUDIO_EMBEDDING_MODEL = os.getenv("LM_STUDIO_EMBEDDING_MODEL", "text-embedding-nomic-embed-text-v1.5")
LM_STUDIO_SYNTHESIS_MODEL = os.getenv("LM_STUDIO_SYNTHESIS_MODEL", "qwen2.5-7b-instruct-mlx")
CHROMA_PATH = os.getenv("CHROMA_PATH", os.path.expanduser("~/.iching/chroma_data"))
if not os.path.isabs(CHROMA_PATH):
    _project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    CHROMA_PATH = os.path.join(_project_root, CHROMA_PATH)
DEFAULT_COLLECTION = os.getenv("DEFAULT_COLLECTION", "iching_toc_test")
