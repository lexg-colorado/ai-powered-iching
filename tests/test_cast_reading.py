#!/usr/bin/env python3
"""End-to-end test of the /cast pipeline: coins -> ChromaDB retrieval -> LLM synthesis."""

import asyncio
import sys
import os

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

from iching import chromadb_client
from iching.hexagram_lookup import cast_coins
from iching.reading import format_reading_header, retrieve_reading_passages, synthesize_reading
from iching import config

console = Console()

QUESTION = "What hidden strengths should I cultivate to navigate the changes ahead?"


async def check_lm_studio() -> bool:
    """Verify LM Studio is reachable."""
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(base_url=config.LM_STUDIO_URL, api_key="lm-studio")
        models = await client.models.list()
        model_ids = [m.id for m in models.data]
        console.print(f"[green]LM Studio connected[/green] — models: {', '.join(model_ids)}")
        return True
    except Exception as e:
        console.print(f"[red]LM Studio not reachable at {config.LM_STUDIO_URL}: {e}[/red]")
        return False


async def find_collection() -> str | None:
    """List ChromaDB collections and pick the best one."""
    collections = chromadb_client.list_collections()
    if not collections:
        console.print("[red]No ChromaDB collections found.[/red]")
        return None

    console.print("[cyan]Available collections:[/cyan]")
    best = None
    for col in collections:
        name = col["name"]
        count = col["count"]
        console.print(f"  - {name} ({count} chunks)")
        if best is None or count > best[1]:
            best = (name, count)

    if best:
        console.print(f"\n[green]Selected: {best[0]} ({best[1]} chunks)[/green]")
        return best[0]
    return None


async def main():
    console.print(Panel(
        "[bold]End-to-End /cast Pipeline Test[/bold]\n"
        f"Question: {QUESTION}",
        border_style="yellow",
    ))

    # Step 1: Prerequisites
    console.print("\n[bold]Step 1: Checking LM Studio[/bold]")
    if not await check_lm_studio():
        console.print("[red]Cannot proceed without LM Studio.[/red]")
        sys.exit(1)

    # Step 2: Find a collection
    console.print("\n[bold]Step 2: Finding collection in ChromaDB[/bold]")
    collection = await find_collection()
    if not collection:
        console.print("[red]No collections available. Run /load-reference first.[/red]")
        sys.exit(1)

    # Step 3: Cast the coins
    console.print("\n[bold]Step 3: Casting coins[/bold]")
    cast = cast_coins()

    header = format_reading_header(cast, QUESTION)
    console.print(Panel(header, title="Cast Complete", border_style="yellow"))

    console.print(f"  Using model: [cyan]{config.LM_STUDIO_SYNTHESIS_MODEL}[/cyan] for synthesis")

    # Step 4: Retrieve passages
    console.print("\n[bold]Step 4: Retrieving passages from ChromaDB[/bold]")
    passages = await retrieve_reading_passages(collection, cast)

    total_passages = 0
    for key, results in passages.items():
        count = len(results)
        total_passages += count
        label = key.replace("_", " ").title()
        status = f"[green]{count} passages[/green]" if count else "[yellow]no passages found[/yellow]"
        console.print(f"  {label}: {status}")

    if total_passages == 0:
        console.print("[red]No passages retrieved. The collection may not contain I Ching content.[/red]")
        sys.exit(1)

    # Step 5: Synthesize reading
    console.print("\n[bold]Step 5: Synthesizing reading via LLM[/bold]")
    try:
        reading_text = await synthesize_reading(cast, passages, QUESTION, model=config.LM_STUDIO_SYNTHESIS_MODEL)
        console.print(Panel(
            Markdown(reading_text),
            title="Reading Interpretation",
            border_style="green",
            padding=(1, 2),
        ))
    except Exception as e:
        console.print(f"[red]LLM synthesis failed: {e}[/red]")
        console.print("[dim]Falling back to raw passages...[/dim]")
        for key, results in passages.items():
            if results:
                label = key.replace("_", " ").title()
                for r in results:
                    text = r.get("chunk_text", "")[:400]
                    score = r.get("score", 0)
                    console.print(Panel(
                        f"{text}...\n\n[dim]Score: {score:.4f}[/dim]",
                        title=label,
                    ))

    console.print("\n[green bold]Test complete.[/green bold]")


if __name__ == "__main__":
    asyncio.run(main())
