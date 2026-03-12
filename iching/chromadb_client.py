"""Simple ChromaDB wrapper for the I Ching divination app.

Replaces the full agent architecture with direct ChromaDB access.
"""

import chromadb

from iching import config
from iching import llm_client


_client = chromadb.PersistentClient(path=config.CHROMA_PATH)


async def query(
    collection: str,
    query_text: str,
    n_results: int = 5,
    where: dict | None = None,
) -> list[dict]:
    """Run a semantic search against a ChromaDB collection."""
    try:
        col = _client.get_collection(name=collection)
    except Exception:
        raise RuntimeError(f"Collection '{collection}' not found")

    query_embedding = await llm_client.embed([query_text])

    query_kwargs = {
        "query_embeddings": query_embedding,
        "n_results": n_results,
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        query_kwargs["where"] = where

    results = col.query(**query_kwargs)

    output = []
    if results["documents"]:
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            output.append({
                "chunk_text": doc,
                "score": 1.0 - dist,
                "metadata": meta,
            })
    return output


def list_collections() -> list[dict]:
    """List all ChromaDB collections with their metadata."""
    collections = _client.list_collections()
    return [
        {
            "name": col.name,
            "metadata": col.metadata,
            "count": col.count(),
        }
        for col in collections
    ]


async def store(collection_name: str, chunks: list[dict]) -> int:
    """Store embedded chunks in a ChromaDB collection. Returns count stored."""
    col = _client.get_or_create_collection(name=collection_name)

    ids = [c["id"] for c in chunks]
    embeddings = [c["embedding"] for c in chunks]
    documents = [c["document"] for c in chunks]
    metadatas = [c["metadata"] for c in chunks]

    col.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )
    return len(chunks)
