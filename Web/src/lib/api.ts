/**
 * API client for the Python FastAPI backend.
 */

import type {
  CastResponse,
  ReadingRequest,
  ReadingResponse,
  SingleTossResponse,
  HealthStatus,
  CollectionInfo,
  TextPassagesResponse,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000");

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function checkHealth(): Promise<HealthStatus> {
  return request<HealthStatus>("/api/health");
}

export async function autoCast(): Promise<CastResponse> {
  return request<CastResponse>("/api/cast", { method: "POST" });
}

export async function singleToss(): Promise<SingleTossResponse> {
  return request<SingleTossResponse>("/api/toss", { method: "POST" });
}

export async function getReading(req: ReadingRequest): Promise<ReadingResponse> {
  return request<ReadingResponse>("/api/reading", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function listCollections(): Promise<CollectionInfo[]> {
  return request<CollectionInfo[]>("/api/collections");
}

export interface ReadingStreamCallbacks {
  onMeta: (data: { cast: CastResponse; header: string }) => void;
  onThinking: (text: string) => void;
  onThinkingDone: () => void;
  onToken: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export async function getReadingStream(
  req: ReadingRequest,
  callbacks: ReadingStreamCallbacks,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/reading/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch {
    callbacks.onError(
      "Cannot connect to the I Ching API server. Make sure it is running on port 8000."
    );
    return;
  }

  if (!res.ok) {
    const body = await res.text();
    callbacks.onError(`API error ${res.status}: ${body}`);
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!; // keep incomplete line in buffer

    let currentEvent = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ") && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          switch (currentEvent) {
            case "meta":
              callbacks.onMeta(data);
              break;
            case "thinking":
              callbacks.onThinking(data.text);
              break;
            case "thinking_done":
              callbacks.onThinkingDone();
              break;
            case "token":
              callbacks.onToken(data.text);
              break;
            case "done":
              callbacks.onDone();
              break;
            case "error":
              callbacks.onError(data.message);
              break;
          }
        } catch {
          // skip malformed JSON lines
        }
        currentEvent = "";
      }
    }
  }

  // If stream ended without a done event, signal completion
  callbacks.onDone();
}

export async function getTextPassages(
  hexagramNumber: number,
  changingLines?: number[],
): Promise<TextPassagesResponse> {
  const params = new URLSearchParams();
  if (changingLines && changingLines.length > 0) {
    params.set("lines", changingLines.join(","));
  }
  const qs = params.toString();
  return request<TextPassagesResponse>(
    `/api/text/${hexagramNumber}${qs ? `?${qs}` : ""}`,
  );
}
