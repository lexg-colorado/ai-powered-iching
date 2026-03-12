"use client";

import { useState, useEffect } from "react";
import type { ClientCastResult } from "@/lib/hexagram";

interface HexagramNumberInputProps {
  castResult: ClientCastResult | null;
  onSetNumber: (n: number) => void;
  label?: string;
  disabled?: boolean;
}

export default function HexagramNumberInput({
  castResult,
  onSetNumber,
  label,
  disabled = false,
}: HexagramNumberInputProps) {
  const [inputValue, setInputValue] = useState("");

  // Sync input with computed hexagram number
  useEffect(() => {
    if (castResult?.primary) {
      setInputValue(String(castResult.primary.king_wen));
    } else {
      setInputValue("");
    }
  }, [castResult]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setInputValue(raw);

    const n = parseInt(raw, 10);
    if (n >= 1 && n <= 64) {
      onSetNumber(n);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs text-muted">
          {label}
        </label>
      )}
      <input
        type="number"
        min={1}
        max={64}
        value={inputValue}
        onChange={handleChange}
        disabled={disabled}
        placeholder="1-64"
        className="w-20 px-2 py-1 text-center text-sm border border-border rounded bg-surface disabled:opacity-50"
      />
    </div>
  );
}
