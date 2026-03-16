"""FastAPI server wrapping the existing iching package for the web frontend."""

from __future__ import annotations

import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from iching import chromadb_client, config, llm_client
from iching.hexagram_lookup import (
    HexagramInfo,
    CastResult,
    all_hexagrams,
    build_cast_from_number,
    build_cast_result,
    cast_coins,
    cast_single_line_auto,
    find_transformation,
    lookup_by_number,
    nuclear_hexagram,
)
from iching.reading import (
    format_reading_header,
    retrieve_reading_passages,
    synthesize_reading,
    synthesize_reading_stream,
)
from iching.text_formatter import format_passage


# ---- Pydantic models ----

class HexagramData(BaseModel):
    king_wen: int
    name: str
    title: str
    binary: str
    upper_trigram: str
    lower_trigram: str

    @classmethod
    def from_info(cls, info: HexagramInfo) -> HexagramData:
        return cls(
            king_wen=info.king_wen,
            name=info.name,
            title=info.title,
            binary=info.binary,
            upper_trigram=info.upper_trigram,
            lower_trigram=info.lower_trigram,
        )


class CastResponse(BaseModel):
    line_values: list[int]
    primary: HexagramData
    changing_lines: list[int]
    relating: HexagramData | None
    change_mask: str
    nuclear: HexagramData | None
    zong_gua: HexagramData | None


class ReadingRequest(BaseModel):
    line_values: list[int]
    question: str | None = None
    collection: str | None = None


class ReadingResponse(BaseModel):
    cast: CastResponse
    interpretation: str
    header: str


class SingleTossResponse(BaseModel):
    coins: list[str]
    total: int


class TransformRequest(BaseModel):
    from_number: int
    to_number: int


class FormattedBlock(BaseModel):
    type: str   # "header" | "paragraph"
    content: str


class PassageEntry(BaseModel):
    text: str
    blocks: list[FormattedBlock] | None = None
    source: str | None = None
    metadata: dict | None = None


class TextPassagesResponse(BaseModel):
    cast: CastResponse
    passages: dict[str, list[PassageEntry]]


class TransformResponse(BaseModel):
    from_hex: HexagramData
    to_hex: HexagramData
    changing_lines: list[int]
    change_mask: str


def _cast_to_response(cast: CastResult) -> CastResponse:
    return CastResponse(
        line_values=cast.line_values,
        primary=HexagramData.from_info(cast.primary),
        changing_lines=cast.changing_lines,
        relating=HexagramData.from_info(cast.relating) if cast.relating else None,
        change_mask=cast.change_mask,
        nuclear=HexagramData.from_info(cast.nuclear) if cast.nuclear else None,
        zong_gua=HexagramData.from_info(cast.zong_gua) if cast.zong_gua else None,
    )


# ---- App setup ----

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: auto-detect LM Studio models
    result = await config.detect_and_configure()
    if result:
        print(f"LM Studio connected — chat: {result['chat_model']}, embedding: {result['embedding_model']}")
    else:
        print(f"Warning: Could not connect to LM Studio at {config.LM_STUDIO_URL}")
    yield


app = FastAPI(title="I Ching API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Endpoints ----

@app.get("/api/health")
async def health():
    """Check LM Studio and ChromaDB connectivity."""
    status = {"lm_studio": False, "chromadb": False, "models": []}

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(base_url=config.LM_STUDIO_URL, api_key="lm-studio")
        models = await client.models.list()
        status["lm_studio"] = True
        status["models"] = [m.id for m in models.data]
    except Exception:
        pass

    try:
        collections = chromadb_client.list_collections()
        status["chromadb"] = True
        status["collections"] = [c["name"] for c in collections]
    except Exception:
        pass

    return status


@app.post("/api/cast", response_model=CastResponse)
async def cast():
    """Auto-cast a full hexagram (6 coin tosses)."""
    result = cast_coins()
    return _cast_to_response(result)


@app.post("/api/toss", response_model=SingleTossResponse)
async def toss():
    """Toss three coins for a single line. Returns coin faces and total."""
    total, coins_str = cast_single_line_auto()
    coins = coins_str.split()
    return SingleTossResponse(coins=coins, total=total)


@app.post("/api/reading", response_model=ReadingResponse)
async def reading(req: ReadingRequest):
    """Retrieve passages and synthesize a reading from line values."""
    if len(req.line_values) != 6:
        raise HTTPException(400, "line_values must contain exactly 6 values")
    if not all(v in (6, 7, 8, 9) for v in req.line_values):
        raise HTTPException(400, "Each line value must be 6, 7, 8, or 9")

    cast = build_cast_result(req.line_values)

    # Retrieve passages from markdown files
    try:
        passages = await retrieve_reading_passages("", cast, use_markdown=True)
    except RuntimeError as e:
        raise HTTPException(500, f"Passage retrieval failed: {e}")

    total_passages = sum(len(r) for r in passages.values())
    if total_passages == 0:
        raise HTTPException(
            404,
            "No relevant passages found. The collection may not contain I Ching content.",
        )

    # Synthesize reading
    try:
        interpretation = await synthesize_reading(
            cast, passages, req.question, model=config.get_synthesis_model(),
        )
    except Exception as e:
        raise HTTPException(500, f"LLM synthesis failed: {e}")

    header = format_reading_header(cast, req.question)

    return ReadingResponse(
        cast=_cast_to_response(cast),
        interpretation=interpretation,
        header=header,
    )


@app.post("/api/reading/stream")
async def reading_stream(req: ReadingRequest):
    """Stream a reading interpretation via Server-Sent Events.

    Events:
      - meta: {cast, header} — sent immediately before LLM starts
      - token: {text} — each generated token/chunk
      - done: {} — stream complete
      - error: {message} — on failure
    """
    if len(req.line_values) != 6:
        raise HTTPException(400, "line_values must contain exactly 6 values")
    if not all(v in (6, 7, 8, 9) for v in req.line_values):
        raise HTTPException(400, "Each line value must be 6, 7, 8, or 9")

    cast = build_cast_result(req.line_values)

    async def event_generator():
        # Retrieve passages (instant with markdown backend)
        try:
            passages = await retrieve_reading_passages("", cast, use_markdown=True)
        except RuntimeError as e:
            yield {"event": "error", "data": json.dumps({"message": f"Passage retrieval failed: {e}"})}
            return

        total_passages = sum(len(r) for r in passages.values())
        if total_passages == 0:
            yield {"event": "error", "data": json.dumps({"message": "No relevant passages found."})}
            return

        header = format_reading_header(cast, req.question)
        cast_data = _cast_to_response(cast).model_dump()

        # Send metadata immediately so the UI can render cast details
        yield {
            "event": "meta",
            "data": json.dumps({"cast": cast_data, "header": header}),
        }

        # Stream LLM tokens with thinking/content classification
        try:
            async for event_type, token in synthesize_reading_stream(
                cast, passages, req.question, model=config.get_synthesis_model(),
            ):
                if event_type == "thinking":
                    yield {"event": "thinking", "data": json.dumps({"text": token})}
                elif event_type == "thinking_done":
                    yield {"event": "thinking_done", "data": "{}"}
                elif event_type == "content":
                    yield {"event": "token", "data": json.dumps({"text": token})}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"message": f"LLM synthesis failed: {e}"})}
            return

        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_generator(), ping=15)


@app.get("/api/models")
async def models():
    """Return the currently active models (auto-detected or fallback defaults)."""
    return {
        "chat": config.get_chat_model(),
        "embedding": config.get_embedding_model(),
        "synthesis": config.get_synthesis_model(),
    }


@app.post("/api/models/refresh")
async def models_refresh():
    """Re-detect models from LM Studio (use after swapping models without restarting)."""
    result = await config.detect_and_configure()
    if result is None:
        raise HTTPException(503, "Could not connect to LM Studio")
    return result


@app.get("/api/collections")
async def collections():
    """List ChromaDB collections."""
    try:
        return chromadb_client.list_collections()
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/hexagrams")
async def hexagrams():
    """Return all 64 hexagrams."""
    return [
        HexagramData.from_info(h).model_dump()
        for h in all_hexagrams()
    ]


@app.post("/api/transform", response_model=TransformResponse)
async def transform(req: TransformRequest):
    """Show the transformation path between two hexagrams."""
    from_hex = lookup_by_number(req.from_number)
    to_hex = lookup_by_number(req.to_number)

    if not from_hex or not to_hex:
        raise HTTPException(400, "Hexagram numbers must be between 1 and 64")

    changing = find_transformation(from_hex, to_hex)
    from iching.hexagram_lookup import compute_change_mask
    mask = compute_change_mask(changing) if changing else "000000"

    return TransformResponse(
        from_hex=HexagramData.from_info(from_hex),
        to_hex=HexagramData.from_info(to_hex),
        changing_lines=changing,
        change_mask=mask,
    )


@app.get("/api/text/{hexagram_number}", response_model=TextPassagesResponse)
async def text_passages(hexagram_number: int, lines: str | None = None, collection: str | None = None):
    """Retrieve raw I Ching text passages for a hexagram (reference mode, no LLM).

    Args:
        hexagram_number: King Wen sequence number (1-64).
        lines: Optional comma-separated changing line positions (e.g. "2,5").
        collection: Optional ChromaDB collection name.
    """
    if hexagram_number < 1 or hexagram_number > 64:
        raise HTTPException(400, "Hexagram number must be between 1 and 64")

    changing_lines = []
    if lines:
        try:
            changing_lines = [int(x.strip()) for x in lines.split(",") if x.strip()]
            if not all(1 <= x <= 6 for x in changing_lines):
                raise ValueError
        except ValueError:
            raise HTTPException(400, "Lines must be comma-separated positions 1-6")

    cast = build_cast_from_number(hexagram_number, changing_lines or None)
    if not cast:
        raise HTTPException(404, f"Hexagram {hexagram_number} not found")

    # Use markdown files for clean deterministic text retrieval
    try:
        raw_passages = await retrieve_reading_passages("", cast, use_markdown=True)
    except RuntimeError as e:
        raise HTTPException(500, f"Passage retrieval failed: {e}")

    # Convert to response format with formatted blocks
    passages: dict[str, list[PassageEntry]] = {}
    for key, docs in raw_passages.items():
        entries = []
        for doc in docs:
            raw_text = doc.get("chunk_text", doc.get("document", doc.get("text", "")))
            blocks = format_passage(raw_text)
            entries.append(PassageEntry(
                text=raw_text,
                blocks=[FormattedBlock(type=b.type, content=b.content) for b in blocks],
                source=doc.get("metadata", {}).get("source"),
                metadata=doc.get("metadata"),
            ))
        if entries:
            passages[key] = entries

    return TextPassagesResponse(
        cast=_cast_to_response(cast),
        passages=passages,
    )
