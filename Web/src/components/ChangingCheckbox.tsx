"use client";

import type { LineValue } from "@/lib/types";

interface ChangingCheckboxProps {
  lineNumber: number;
  value: LineValue | null;
  onToggle: () => void;
}

export default function ChangingCheckbox({
  lineNumber,
  value,
  onToggle,
}: ChangingCheckboxProps) {
  const isSet = value !== null;
  const isChanging = value === 6 || value === 9;

  return (
    <label
      className={`flex items-center gap-1.5 h-6 text-xs select-none ${
        isSet ? "cursor-pointer" : "cursor-not-allowed opacity-40"
      }`}
    >
      <input
        type="checkbox"
        checked={isChanging}
        onChange={onToggle}
        disabled={!isSet}
        className="w-3.5 h-3.5 rounded accent-yang"
      />
      <span className="text-muted hidden sm:inline">
        changing
      </span>
    </label>
  );
}
