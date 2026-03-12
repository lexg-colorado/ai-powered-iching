#!/usr/bin/env python3
"""I Ching CLI entry point."""

import argparse
import asyncio


def main():
    parser = argparse.ArgumentParser(
        prog="iching",
        description="I Ching Divination — cast readings and explore hexagrams",
    )
    parser.add_argument(
        "-a", "--auto", action="store_true",
        help="Auto-cast (non-interactive penny toss)",
    )
    parser.add_argument(
        "-q", "--question", type=str, default=None,
        help="Question for the reading",
    )
    parser.add_argument(
        "--collections", action="store_true",
        help="List ChromaDB collections and exit",
    )
    parser.add_argument(
        "--load-reference", action="store_true",
        help="Load hexagram reference data into ChromaDB and exit",
    )
    parser.add_argument(
        "--transform", nargs=2, type=int, metavar=("FROM", "TO"),
        help="Show transformation path between two hexagrams (by number)",
    )
    parser.add_argument(
        "--lookup", type=int, metavar="N",
        help="Look up raw I Ching text passages for hexagram N (1-64)",
    )
    parser.add_argument(
        "--lines", type=str, default=None,
        help="Changing line positions for --lookup (comma-separated, e.g. 2,5)",
    )

    args = parser.parse_args()

    if args.collections:
        from iching.app import cmd_collections
        cmd_collections()
        return

    if args.load_reference:
        from iching.app import cmd_load_reference, Session
        session = Session()
        asyncio.run(cmd_load_reference(session))
        return

    if args.transform:
        from iching.app import cmd_transform, Session
        session = Session()
        transform_args = f"{args.transform[0]} {args.transform[1]}"
        asyncio.run(cmd_transform(session, transform_args))
        return

    if args.lookup is not None:
        from iching.app import cmd_lookup, Session
        session = Session()
        lookup_args = str(args.lookup)
        if args.lines:
            lookup_args += f" {args.lines}"
        asyncio.run(cmd_lookup(session, lookup_args))
        return

    if args.auto:
        asyncio.run(_auto_cast(args.question))
        return

    # Default: interactive REPL
    from iching.app import repl_main
    asyncio.run(repl_main())


async def _auto_cast(question: str | None):
    """Non-interactive auto-cast: toss coins, retrieve passages, print reading."""
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel

    from iching.app import Session, initialize
    from iching.hexagram_lookup import cast_coins
    from iching.reading import format_reading_header, retrieve_reading_passages, synthesize_reading
    from iching import config

    console = Console()

    await initialize()

    cast = cast_coins()

    header = format_reading_header(cast, question)
    console.print(Panel(header, title="Cast Complete", border_style="yellow"))

    console.print("\n[cyan]Retrieving passages...[/cyan]")
    try:
        passages = await retrieve_reading_passages("", cast, use_markdown=True)
    except RuntimeError as e:
        console.print(f"[red]{e}[/red]")
        return

    total_passages = sum(len(r) for r in passages.values())
    if total_passages == 0:
        console.print("[yellow]No passages found.[/yellow]")
        return

    console.print(f"[cyan]Synthesizing reading...[/cyan]  [dim](model: {config.LM_STUDIO_SYNTHESIS_MODEL})[/dim]")
    try:
        reading_text = await synthesize_reading(
            cast, passages, question, model=config.LM_STUDIO_SYNTHESIS_MODEL,
        )
        console.print(Panel(
            Markdown(reading_text),
            title="Reading Interpretation",
            border_style="green",
            padding=(1, 2),
        ))
    except Exception as e:
        console.print(f"[red]LLM synthesis failed: {e}[/red]")
