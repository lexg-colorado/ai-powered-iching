#!/usr/bin/env python3
"""I Ching Divination App — REPL Interface"""

import asyncio
import os

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table

from iching import chromadb_client
from iching import llm_client
from iching import config
from iching.hexagram_lookup import (
    build_cast_from_number,
    cast_single_line_auto, parse_manual_toss, build_cast_result,
    nuclear_hexagram, lookup_by_number, find_transformation,
    hamming_distance, nearby_hexagrams, compute_change_mask,
    detect_hexagram_references, expand_query, all_hexagrams,
)
from iching.reading import (
    format_reading_header, retrieve_reading_passages, synthesize_reading,
)

console = Console()


class Session:
    def __init__(self):
        self.active_collection: str | None = config.DEFAULT_COLLECTION
        self.conversation_history: list[dict] = []

    def _system_prompt(self) -> str:
        parts = [
            "You are an I Ching divination assistant. You help users understand "
            "hexagrams, cast readings, and explore the I Ching's wisdom."
        ]
        if self.active_collection:
            parts.append(f"\nActive collection: {self.active_collection}")
        return "\n".join(parts)


async def initialize():
    """Verify LM Studio connectivity and show collections."""
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(base_url=config.LM_STUDIO_URL, api_key="lm-studio")
        models = await client.models.list()
        model_ids = [m.id for m in models.data]
        console.print(f"[green]LM Studio connected[/green] — models: {', '.join(model_ids)}")
    except Exception as e:
        console.print(f"[yellow]Warning: Could not connect to LM Studio at {config.LM_STUDIO_URL}[/yellow]")
        console.print(f"  {e}")

    collections = chromadb_client.list_collections()
    if collections:
        console.print(f"[cyan]Existing collections:[/cyan] {', '.join(c['name'] for c in collections)}")


def print_help():
    table = Table(title="Commands", show_header=True)
    table.add_column("Command", style="cyan")
    table.add_column("Description")
    table.add_row("/cast [question]", "Interactive I Ching penny casting (auto or manual) with reading")
    table.add_row("/transform <from> <to>", "Show transformation path between two hexagrams")
    table.add_row("/xref <text>", "Query with hexagram cross-reference enrichment")
    table.add_row("/query <text>", "Semantic search against a collection")
    table.add_row("/load-reference", "Load hexagram reference data into ChromaDB")
    table.add_row("/collections", "List ChromaDB collections")
    table.add_row("/lookup <N> [lines]", "Look up hexagram text (e.g. /lookup 53 2,5)")
    table.add_row("/help", "Show this help")
    table.add_row("/quit", "Exit")
    console.print(table)


async def cmd_lookup(session: Session, args: str):
    """Look up raw I Ching text passages for a hexagram number, optionally with changing lines."""
    parts = args.strip().split()
    if not parts:
        console.print("[red]Usage: /lookup <hexagram_number> [changing_lines][/red]")
        console.print("[dim]  e.g. /lookup 53       — hexagram 53 (all passages)[/dim]")
        console.print("[dim]  e.g. /lookup 53 2,5   — hexagram 53 with changing lines 2 and 5[/dim]")
        return

    try:
        hex_num = int(parts[0])
    except ValueError:
        console.print("[red]Hexagram number must be an integer (1-64).[/red]")
        return

    changing_lines = []
    if len(parts) > 1:
        try:
            changing_lines = [int(x.strip()) for x in parts[1].split(",") if x.strip()]
            if not all(1 <= x <= 6 for x in changing_lines):
                raise ValueError
        except ValueError:
            console.print("[red]Changing lines must be comma-separated positions 1-6.[/red]")
            return

    cast = build_cast_from_number(hex_num, changing_lines or None)
    if not cast:
        console.print(f"[red]Hexagram {hex_num} not found.[/red]")
        return

    header = format_reading_header(cast)
    console.print(Panel(header, title="Hexagram Reference", border_style="cyan"))

    # Retrieve passages from markdown files (no ChromaDB needed)
    passages = await retrieve_reading_passages("", cast, use_markdown=True)

    total = sum(len(r) for r in passages.values())
    if total == 0:
        console.print("[yellow]No passages found for this hexagram.[/yellow]")
        return

    # Display passages by section
    section_labels = {
        "primary": "Primary Hexagram",
        "relating": "Relating Hexagram",
        "nuclear_primary": "Nuclear Hexagram (Primary)",
        "nuclear_relating": "Nuclear Hexagram (Relating)",
    }

    for key, docs in passages.items():
        if not docs:
            continue
        if key.startswith("line_"):
            label = f"Changing Line {key.replace('line_', '')}"
        else:
            label = section_labels.get(key, key)

        console.print(f"\n[bold cyan]{label}[/bold cyan]")
        for doc in docs:
            text = doc.get("chunk_text", doc.get("document", doc.get("text", "")))
            source = doc.get("metadata", {}).get("source", "")
            console.print(Panel(
                text,
                subtitle=f"[dim]{source}[/dim]" if source else None,
                border_style="dim",
                padding=(0, 1),
            ))


async def cmd_query(session: Session, args: str):
    query_text = args.strip()
    if not query_text:
        console.print("[red]Usage: /query <search text>[/red]")
        return

    if not session.active_collection:
        collections = chromadb_client.list_collections()
        if not collections:
            console.print("[red]No collections found. Use /load-reference first.[/red]")
            return
        console.print("[yellow]Available collections:[/yellow]")
        for col in collections:
            console.print(f"  - {col['name']} ({col['count']} chunks)")
        console.print("[yellow]Which collection to query?[/yellow]")
        name = await asyncio.to_thread(input, "> ")
        session.active_collection = name.strip()

    # Expand query with hexagram aliases
    effective_query = expand_query(query_text)
    query_expanded = effective_query != query_text

    console.print(f"Searching [cyan]{session.active_collection}[/cyan]...")
    try:
        results = await chromadb_client.query(
            collection=session.active_collection,
            query_text=effective_query,
        )
    except RuntimeError as e:
        console.print(f"[red]{e}[/red]")
        return

    if results:
        if query_expanded:
            console.print(f"[dim]Query expanded: {effective_query[:200]}[/dim]")

        for i, result in enumerate(results):
            score = result["score"]
            text = result["chunk_text"][:300]
            meta = result.get("metadata", {})
            extra = ""
            if meta.get("hexagram_number"):
                extra = f" | Hexagram: {meta['hexagram_number']} ({meta.get('hexagram_name', '')})"
            elif meta.get("hexagram_numbers"):
                extra = f" | Hexagrams: {meta['hexagram_numbers']}"
            console.print(Panel(
                f"{text}...\n\n[dim]Score: {score:.4f} | Pages: {meta.get('page_numbers', 'N/A')}{extra}[/dim]",
                title=f"Result {i+1}",
            ))
    else:
        console.print("[yellow]No results found.[/yellow]")


async def cmd_xref(session: Session, args: str):
    """Query with explicit hexagram cross-referencing."""
    query_text = args.strip()
    if not query_text:
        console.print("[red]Usage: /xref <search text>[/red]")
        return

    refs = detect_hexagram_references(query_text)
    if refs:
        console.print("[cyan]Hexagram references detected:[/cyan]")
        for info in refs:
            console.print(
                f"  #{info.king_wen} {info.name} / {info.title}  "
                f"[dim]binary={info.binary}  upper={info.upper_trigram}  lower={info.lower_trigram}[/dim]"
            )
        expanded = expand_query(query_text)
        console.print(f"[dim]Expanded query: {expanded[:200]}[/dim]")
    else:
        console.print("[yellow]No hexagram references detected in query.[/yellow]")

    await cmd_query(session, args)


async def cmd_cast(session: Session, args: str):
    """Interactive I Ching penny casting with auto or manual mode."""
    question = args.strip() or None

    LINE_INFO = {
        6: ("old yin",    "---x---", True),
        7: ("young yang", "-------", False),
        8: ("young yin",  "--- ---", False),
        9: ("old yang",   "---o---", True),
    }
    HEADS_COUNT = {6: 0, 7: 1, 8: 2, 9: 3}

    intro = ""
    if question:
        intro = f"Question: {question}\n\n"
    intro += (
        "Choose your casting method:\n"
        "  [bold]a[/bold] — Auto (agent tosses the pennies for you)\n"
        "  [bold]m[/bold] — Manual (you toss real pennies and enter results)"
    )
    console.print(Panel(intro, title="I Ching Casting", border_style="yellow"))

    mode_raw = await asyncio.to_thread(input, "> ")
    manual = mode_raw.strip().lower().startswith("m")
    all_at_once = False

    line_values = []
    for toss_num in range(1, 7):
        if toss_num == 1:
            pos_label = " (bottom line)"
        elif toss_num == 6:
            pos_label = " (top line)"
        else:
            pos_label = ""

        console.print(f"\n[bold]Toss {toss_num} of 6{pos_label}[/bold]")

        if manual:
            console.print("  Toss your three pennies and enter the result.")
            console.print("  [dim]Formats: HHT, 2h1t, 3t, or 6/7/8/9[/dim]")
            while True:
                raw = await asyncio.to_thread(input, "> ")
                if raw.strip().lower() in ("/quit", "/cancel"):
                    console.print("Casting cancelled.")
                    return
                val = parse_manual_toss(raw)
                if val is not None:
                    break
                console.print("  [red]Could not parse. Try: HHT, TTH, 3h, 2h1t, or 6/7/8/9[/red]")

            h = HEADS_COUNT[val]
            t = 3 - h
            console.print(f"  {h} heads + {t} tails = {val} = {LINE_INFO[val][0]}")
        else:
            if not all_at_once:
                console.print("  [dim]Press Enter to toss (or 'a' for all remaining at once)[/dim]")
                raw = await asyncio.to_thread(input, "> ")
                if raw.strip().lower() in ("/quit", "/cancel"):
                    console.print("Casting cancelled.")
                    return
                if raw.strip().lower() == "a":
                    all_at_once = True

            val, coins_str = cast_single_line_auto()
            h = coins_str.count("H")
            t = coins_str.count("T")
            console.print(f"  Tossed: {coins_str}  ({h} heads + {t} tails)")
            console.print(f"  = {val} = {LINE_INFO[val][0]}")

        name, symbol, changing = LINE_INFO[val]
        marker = " [yellow]<- changing[/yellow]" if changing else ""
        console.print(f"  {symbol}{marker}")

        line_values.append(val)

        console.print("\n  [dim]Hexagram so far (bottom to top):[/dim]")
        for i in range(len(line_values) - 1, -1, -1):
            v = line_values[i]
            m = " <-" if LINE_INFO[v][2] else ""
            console.print(f"  Line {i+1}: {LINE_INFO[v][1]}{m}")

    cast = build_cast_result(line_values)

    header = format_reading_header(cast, question)
    console.print(Panel(header, title="Cast Complete", border_style="yellow"))

    # Retrieve passages from markdown files and synthesize reading
    console.print("\n[cyan]Retrieving passages for reading...[/cyan]")
    try:
        passages = await retrieve_reading_passages("", cast, use_markdown=True)
    except RuntimeError as e:
        console.print(f"[red]{e}[/red]")
        return

    total_passages = sum(len(r) for r in passages.values())
    for key, results in passages.items():
        count = len(results)
        label = key.replace("_", " ").title()
        status = f"[green]{count} passages[/green]" if count else "[yellow]no passages found[/yellow]"
        console.print(f"  {label}: {status}")

    if total_passages == 0:
        console.print("[yellow]No relevant passages found.[/yellow]")
        return

    console.print(f"\n[cyan]Synthesizing reading...[/cyan]  [dim](model: {config.LM_STUDIO_SYNTHESIS_MODEL})[/dim]")
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
        console.print("[dim]Falling back to raw passages...[/dim]")
        for key, results in passages.items():
            if results:
                label = key.replace("_", " ").title()
                for r in results:
                    text = r.get("chunk_text", "")[:400]
                    console.print(Panel(text, title=label))


async def cmd_transform(session: Session, args: str):
    """Show the transformation path between two hexagrams."""
    parts = args.strip().split()
    if len(parts) < 2:
        console.print("[red]Usage: /transform <from_number> <to_number>[/red]")
        console.print("[dim]Example: /transform 1 2[/dim]")
        return

    try:
        from_num = int(parts[0])
        to_num = int(parts[1])
    except ValueError:
        console.print("[red]Both arguments must be hexagram numbers (1-64).[/red]")
        return

    from_hex = lookup_by_number(from_num)
    to_hex = lookup_by_number(to_num)
    if not from_hex or not to_hex:
        console.print("[red]Hexagram number must be between 1 and 64.[/red]")
        return

    changing = find_transformation(from_hex, to_hex)
    dist = hamming_distance(from_hex, to_hex)

    text = f"From: #{from_hex.king_wen} {from_hex.name} / {from_hex.title}  ({from_hex.binary})\n"
    text += f"  To: #{to_hex.king_wen} {to_hex.name} / {to_hex.title}  ({to_hex.binary})\n\n"

    if changing:
        text += f"Changing lines: {', '.join(str(l) for l in changing)}\n"
        mask_str = compute_change_mask(changing)
        text += f"Change mask: {mask_str}\n"
    else:
        text += "Same hexagram -- no changes needed.\n"

    text += f"Hamming distance: {dist}\n"

    nuc_from = nuclear_hexagram(from_hex.binary)
    nuc_to = nuclear_hexagram(to_hex.binary)
    if nuc_from:
        text += f"\nNuclear of #{from_hex.king_wen}: #{nuc_from.king_wen} {nuc_from.name}"
    if nuc_to:
        text += f"\nNuclear of #{to_hex.king_wen}: #{nuc_to.king_wen} {nuc_to.name}"

    nearby = nearby_hexagrams(from_hex.binary, max_distance=1)
    if nearby:
        text += f"\n\nHexagrams 1 line away from #{from_hex.king_wen}:"
        for info, d in nearby:
            text += f"\n  #{info.king_wen} {info.name} / {info.title}"

    console.print(Panel(text, title="Hexagram Transformation", border_style="cyan"))


async def cmd_load_reference(session: Session):
    """Load hexagram reference data as a ChromaDB collection."""
    hexagrams = all_hexagrams()
    if not hexagrams:
        console.print("[red]Failed to load hexagram data.[/red]")
        return

    console.print(f"Building reference collection from {len(hexagrams)} hexagrams...")

    # Build chunks and embed them
    texts = []
    chunk_data = []
    for info in hexagrams:
        text = (
            f"Hexagram {info.king_wen}: {info.name} / {info.title}. "
            f"Binary representation: {info.binary}. "
            f"Upper trigram: {info.upper_trigram}. Lower trigram: {info.lower_trigram}. "
            f"This is hexagram number {info.king_wen} in the King Wen sequence of the I Ching."
        )
        texts.append(text)
        chunk_data.append({
            "id": f"hexagram_{info.king_wen}",
            "document": text,
            "metadata": {
                "hexagram_number": info.king_wen,
                "hexagram_name": info.name,
                "hexagram_title": info.title,
                "hexagram_binary": info.binary,
                "upper_trigram": info.upper_trigram,
                "lower_trigram": info.lower_trigram,
                "source": "hexagram_reference",
            },
        })

    console.print("Embedding hexagram reference data...")
    try:
        embeddings = await llm_client.embed(texts)
    except Exception as e:
        console.print(f"[red]Embedding failed: {e}[/red]")
        return

    for i, emb in enumerate(embeddings):
        chunk_data[i]["embedding"] = emb

    collection_name = "hexagram_reference"
    console.print(f"Storing in [cyan]{collection_name}[/cyan]...")
    try:
        count = await chromadb_client.store(collection_name, chunk_data)
        console.print(f"[green]Stored {count} hexagrams in '{collection_name}'[/green]")
    except Exception as e:
        console.print(f"[red]Storage failed: {e}[/red]")


def cmd_collections():
    collections = chromadb_client.list_collections()
    if collections:
        table = Table(title="Collections")
        table.add_column("Name", style="cyan")
        table.add_column("Chunks", justify="right")
        table.add_column("Method")
        for col in collections:
            table.add_row(
                col["name"],
                str(col["count"]),
                col.get("metadata", {}).get("chunking_method", ""),
            )
        console.print(table)
    else:
        console.print("[yellow]No collections found.[/yellow]")


async def handle_conversation(session: Session, user_input: str):
    """Send free-form input to the LLM for conversational interaction."""
    session.conversation_history.append({"role": "user", "content": user_input})

    messages = [{"role": "system", "content": session._system_prompt()}] + session.conversation_history
    messages = await llm_client.summarize_conversation(messages)

    response = await llm_client.chat(messages=messages)
    msg = response.choices[0].message

    if msg.content:
        session.conversation_history.append({"role": "assistant", "content": msg.content})
        console.print(Markdown(msg.content))


async def repl_main():
    console.print(Panel(
        "[bold]I Ching Divination[/bold]\n"
        "Cast readings, explore hexagrams, and consult the oracle.\n"
        "Type /help for commands, or chat naturally.",
        border_style="yellow",
    ))

    await initialize()
    console.print()

    session = Session()

    while True:
        try:
            user_input = await asyncio.to_thread(input, "You: ")
        except (EOFError, KeyboardInterrupt):
            console.print("\nGoodbye!")
            break

        user_input = user_input.strip()
        if not user_input:
            continue

        try:
            if user_input.startswith("/"):
                parts = user_input.split(maxsplit=1)
                cmd = parts[0].lower()
                args = parts[1] if len(parts) > 1 else ""

                if cmd == "/quit" or cmd == "/exit":
                    console.print("Goodbye!")
                    break
                elif cmd == "/help":
                    print_help()
                elif cmd == "/cast":
                    await cmd_cast(session, args)
                elif cmd == "/transform":
                    await cmd_transform(session, args)
                elif cmd == "/xref":
                    await cmd_xref(session, args)
                elif cmd == "/query":
                    await cmd_query(session, args)
                elif cmd == "/load-reference":
                    await cmd_load_reference(session)
                elif cmd == "/lookup":
                    await cmd_lookup(session, args)
                elif cmd == "/collections":
                    cmd_collections()
                else:
                    console.print(f"[red]Unknown command: {cmd}. Type /help for available commands.[/red]")
            else:
                await handle_conversation(session, user_input)
        except Exception as e:
            console.print(f"[red]Error: {e}[/red]")


if __name__ == "__main__":
    asyncio.run(repl_main())
