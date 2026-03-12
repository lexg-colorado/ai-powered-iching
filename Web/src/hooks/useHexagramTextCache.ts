/**
 * Fetches and caches hexagram text passages from the backend API.
 *
 * Maintains an in-memory Map so repeated selections are instant.
 * Returns { data, loading, error } for the currently requested hexagram.
 */

import { useRef, useState, useEffect, useCallback } from "react";

export interface TextSection {
  heading: string;
  body: string;
}

export interface CachedHexagramText {
  overview: string | null;
  judgment: string | null;
  image: string | null;
  sections: TextSection[];
}

interface UseHexagramTextCacheResult {
  data: CachedHexagramText | null;
  loading: boolean;
  error: string | null;
}

const API_BASE = "http://localhost:8000";

/**
 * Parse the API response passages into structured text sections.
 */
function parsePassages(
  passages: Record<string, Array<{ text: string; blocks?: Array<{ type: string; content: string }> | null }>>,
): CachedHexagramText {
  let overview: string | null = null;
  let judgment: string | null = null;
  let image: string | null = null;
  const sections: TextSection[] = [];

  // The "primary" key contains the hexagram's main text
  const primaryEntries = passages["primary"] ?? [];

  for (const entry of primaryEntries) {
    const blocks = entry.blocks;
    if (!blocks || blocks.length === 0) {
      // Fallback: use the raw text
      if (!overview) {
        overview = entry.text.slice(0, 500);
      }
      continue;
    }

    // Walk through blocks and extract sections by header
    let currentHeading = "";
    let currentBody: string[] = [];

    for (const block of blocks) {
      if (block.type === "header") {
        // Save previous section
        if (currentHeading && currentBody.length > 0) {
          const body = currentBody.join("\n\n");
          categorizeSection(currentHeading, body, sections, { overview, judgment, image }, (o) => { overview = o; }, (j) => { judgment = j; }, (i) => { image = i; });
        }
        currentHeading = block.content;
        currentBody = [];
      } else {
        currentBody.push(block.content);
      }
    }

    // Save last section
    if (currentHeading && currentBody.length > 0) {
      const body = currentBody.join("\n\n");
      categorizeSection(currentHeading, body, sections, { overview, judgment, image }, (o) => { overview = o; }, (j) => { judgment = j; }, (i) => { image = i; });
    }
  }

  // If no structured blocks, try to extract from raw text
  if (!overview && !judgment && !image && primaryEntries.length > 0) {
    overview = primaryEntries[0].text.slice(0, 600);
  }

  return { overview, judgment, image, sections };
}

function categorizeSection(
  heading: string,
  body: string,
  sections: TextSection[],
  current: { overview: string | null; judgment: string | null; image: string | null },
  setOverview: (v: string) => void,
  setJudgment: (v: string) => void,
  setImage: (v: string) => void,
) {
  const lower = heading.toLowerCase();

  if (lower.includes("judgment") || lower.includes("judgement")) {
    if (!current.judgment) setJudgment(body);
  } else if (lower.includes("image") || lower.includes("象")) {
    if (!current.image) setImage(body);
  } else if (
    lower.includes("overview") ||
    lower.includes("description") ||
    lower.includes("meaning") ||
    lower === heading.toLowerCase() // First non-categorized section
  ) {
    if (!current.overview) setOverview(body);
    else sections.push({ heading, body });
  } else {
    sections.push({ heading, body });
  }
}

export function useHexagramTextCache(kingWen: number | null): UseHexagramTextCacheResult {
  const cache = useRef<Map<number, CachedHexagramText>>(new Map());
  const [data, setData] = useState<CachedHexagramText | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchText = useCallback(async (num: number) => {
    // Check cache first
    const cached = cache.current.get(num);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/text/${num}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      const parsed = parsePassages(json.passages ?? {});

      cache.current.set(num, parsed);
      setData(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load text");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (kingWen == null) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Check cache synchronously
    const cached = cache.current.get(kingWen);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      return;
    }

    fetchText(kingWen);
  }, [kingWen, fetchText]);

  return { data, loading, error };
}
