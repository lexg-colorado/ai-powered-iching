from collections.abc import AsyncIterator

from openai import AsyncOpenAI
from iching import config


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
        "model": model or config.LM_STUDIO_MODEL,
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
        model=model or config.LM_STUDIO_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def embed(texts: list[str], model: str | None = None) -> list[list[float]]:
    """Generate embeddings via LM Studio's /v1/embeddings endpoint."""
    client = get_client()
    response = await client.embeddings.create(
        model=model or config.LM_STUDIO_EMBEDDING_MODEL,
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
