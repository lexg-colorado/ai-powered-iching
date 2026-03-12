/**
 * Reusable hexagram search input with autocomplete dropdown.
 *
 * Accepts King Wen number (1-64) or name/title substring.
 * Used across wheel sidebar modes to select hexagrams.
 */

"use client";

import { useState, useRef, useCallback, useEffect, memo } from "react";
import { allHexagrams, lookupByNumber } from "../../lib/hexagram";
import type { HexagramData } from "../../lib/types";

interface HexagramSearchInputProps {
  value: number | null;
  onChange: (kingWen: number) => void;
  label?: string;
  placeholder?: string;
}

const MAX_SUGGESTIONS = 8;

function HexagramSearchInputInner({
  value,
  onChange,
  label,
  placeholder = "Number or name...",
}: HexagramSearchInputProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Resolve the currently selected hexagram for display
  const selected = value != null ? lookupByNumber(value) : null;

  // Filter hexagrams based on query
  const suggestions = useCallback((): HexagramData[] => {
    const q = query.trim();
    if (!q) return [];
    const all = allHexagrams();

    // Numeric query: match king_wen prefix
    if (/^\d+$/.test(q)) {
      const num = parseInt(q, 10);
      // Exact match first
      const exact = all.filter((h) => h.king_wen === num);
      if (exact.length > 0) return exact;
      // Prefix match
      return all
        .filter((h) => String(h.king_wen).startsWith(q))
        .slice(0, MAX_SUGGESTIONS);
    }

    // Text query: substring match against name and title
    const lower = q.toLowerCase();
    return all
      .filter(
        (h) =>
          h.name.toLowerCase().includes(lower) ||
          h.title.toLowerCase().includes(lower),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [query]);

  const items = focused ? suggestions() : [];

  const selectItem = useCallback(
    (hex: HexagramData) => {
      onChange(hex.king_wen);
      setQuery("");
      setHighlightIdx(-1);
      inputRef.current?.blur();
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < items.length) {
          selectItem(items[highlightIdx]);
        } else if (items.length === 1) {
          selectItem(items[0]);
        }
      } else if (e.key === "Escape") {
        setQuery("");
        inputRef.current?.blur();
      }
    },
    [items, highlightIdx, selectItem],
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  // Reset highlight when query changes
  useEffect(() => {
    setHighlightIdx(-1);
  }, [query]);

  return (
    <div className="mb-3">
      {label && (
        <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block font-medium">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => setFocused(false), 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder={selected ? `#${selected.king_wen} ${selected.name}` : placeholder}
          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded text-foreground placeholder:text-muted/60 focus:outline-none focus:border-yang/50 transition-colors"
        />

        {/* Dropdown */}
        {items.length > 0 && focused && (
          <div
            ref={listRef}
            className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-surface border border-border rounded shadow-lg"
          >
            {items.map((hex, i) => (
              <button
                key={hex.king_wen}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectItem(hex);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  i === highlightIdx
                    ? "bg-yang/10 text-yang"
                    : "text-foreground hover:bg-surface"
                }`}
              >
                <span className="font-mono text-muted mr-1.5">#{hex.king_wen}</span>
                <span>{hex.name}</span>
                <span className="text-muted ml-1 italic">{hex.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current selection indicator */}
      {selected && !focused && (
        <div className="mt-1 text-[10px] text-muted">
          Selected: <span className="text-foreground">#{selected.king_wen} {selected.name}</span>
        </div>
      )}
    </div>
  );
}

export const HexagramSearchInput = memo(HexagramSearchInputInner);
