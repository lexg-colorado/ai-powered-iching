import re
from collections.abc import AsyncIterator

from openai import AsyncOpenAI
from iching import config

_THINK_PATTERN = re.compile(r"<think>(.*?)</think>", re.DOTALL)


def strip_think_blocks(text: str) -> tuple[str, str | None]:
    """Remove thinking content from LLM output.

    Handles two formats:
      1. Explicit <think>...</think> tags
      2. LM Studio/Qwen3 implicit thinking: output starts with thinking content,
         ends with </think>, followed by actual content (no opening <think> tag)

    Returns (clean_content, thinking_text). thinking_text is None if no blocks found.
    """
    # First try explicit <think>...</think> blocks
    thinking_parts = _THINK_PATTERN.findall(text)
    if thinking_parts:
        clean = _THINK_PATTERN.sub("", text).strip()
        thinking = "\n".join(thinking_parts).strip()
        return clean, thinking

    # Handle implicit thinking: everything before </think> is thinking
    close_idx = text.find("</think>")
    if close_idx != -1:
        thinking = text[:close_idx].strip()
        clean = text[close_idx + 8:].strip()
        return clean, thinking if thinking else None

    return text.strip(), None


def get_client() -> AsyncOpenAI:
    return AsyncOpenAI(base_url=config.LM_STUDIO_URL, api_key="lm-studio")


async def chat(
    messages: list[dict],
    tools: list[dict] | None = None,
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict:
    """Send a chat completion request to LM Studio. Returns the full response dict."""
    client = get_client()
    kwargs = {
        "model": model or config.get_chat_model(),
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    response = await client.chat.completions.create(**kwargs)
    return response


async def chat_stream(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AsyncIterator[str]:
    """Stream chat completion tokens from LM Studio. Yields content deltas."""
    client = get_client()
    stream = await client.chat.completions.create(
        model=model or config.get_chat_model(),
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def chat_stream_with_thinking(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AsyncIterator[tuple[str, str]]:
    """Stream tokens, classifying each as 'thinking' or 'content'.

    Yields tuples of (event_type, text) where event_type is:
      - "thinking": token is part of thinking output
      - "thinking_done": thinking ended (text is empty)
      - "content": token is actual response content

    Handles two formats:
      1. Explicit <think>...</think> tags
      2. LM Studio/Qwen3 implicit: output starts in thinking mode (the chat
         template prepends <think> which is stripped from the API response),
         everything before </think> is thinking, everything after is content.

    For thinking models, starts in thinking mode by default.
    Transparent no-op for non-thinking models.
    """
    effective_model = model or config.get_chat_model()
    # Thinking models start with implicit <think> — the LM Studio chat template
    # prepends it but the API strips the opening tag from the response
    in_think = config.is_thinking_model(effective_model)
    buffer = ""
    thinking_emitted = False

    async for token in chat_stream(messages, model, temperature, max_tokens):
        buffer += token

        while buffer:
            if not in_think:
                # Look for explicit <think> tag
                think_start = buffer.find("<think>")
                if think_start == -1:
                    safe_end = len(buffer)
                    for i in range(1, min(8, len(buffer) + 1)):
                        if "<think>".startswith(buffer[-i:]):
                            safe_end = len(buffer) - i
                            break
                    if safe_end > 0:
                        yield ("content", buffer[:safe_end])
                        buffer = buffer[safe_end:]
                    break
                else:
                    if think_start > 0:
                        yield ("content", buffer[:think_start])
                    buffer = buffer[think_start + 7:]
                    in_think = True
            else:
                # Inside thinking — look for </think> to transition to content
                think_end = buffer.find("</think>")
                if think_end == -1:
                    safe_end = len(buffer)
                    for i in range(1, min(9, len(buffer) + 1)):
                        if "</think>".startswith(buffer[-i:]):
                            safe_end = len(buffer) - i
                            break
                    if safe_end > 0:
                        yield ("thinking", buffer[:safe_end])
                        thinking_emitted = True
                        buffer = buffer[safe_end:]
                    break
                else:
                    if think_end > 0:
                        yield ("thinking", buffer[:think_end])
                        thinking_emitted = True
                    buffer = buffer[think_end + 8:]
                    in_think = False
                    if thinking_emitted:
                        yield ("thinking_done", "")

    # Flush remaining buffer
    if buffer:
        yield ("thinking" if in_think else "content", buffer)


async def embed(texts: list[str], model: str | None = None) -> list[list[float]]:
    """Generate embeddings via LM Studio's /v1/embeddings endpoint."""
    client = get_client()
    response = await client.embeddings.create(
        model=model or config.get_embedding_model(),
        input=texts,
    )
    return [item.embedding for item in response.data]


async def summarize_conversation(history: list[dict], max_turns: int = 20) -> list[dict]:
    """Summarize older conversation history to stay within context limits.

    Keeps the system message and the most recent max_turns messages intact.
    Summarizes everything in between into a single assistant message.
    """
    if len(history) <= max_turns + 1:
        return history

    system_msgs = [m for m in history if m["role"] == "system"]
    non_system = [m for m in history if m["role"] != "system"]

    if len(non_system) <= max_turns:
        return history

    to_summarize = non_system[:-max_turns]
    to_keep = non_system[-max_turns:]

    summary_text = "\n".join(
        f"{m['role'].upper()}: {m.get('content', '[tool call]')[:200]}"
        for m in to_summarize
    )

    summary_response = await chat(
        messages=[
            {"role": "system", "content": "Summarize the following conversation history concisely, preserving key decisions, file paths, and results. Be brief."},
            {"role": "user", "content": summary_text},
        ],
        temperature=0.3,
        max_tokens=512,
    )

    summary_content = summary_response.choices[0].message.content
    summary_msg = {"role": "assistant", "content": f"[Conversation summary]: {summary_content}"}

    return system_msgs + [summary_msg] + to_keep
