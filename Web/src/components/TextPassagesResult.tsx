"use client";

import type { TextPassagesResponse, FormattedBlock } from "@/lib/types";

interface TextPassagesResultProps {
  data: TextPassagesResponse;
  onNewConsultation: () => void;
}

/** Section label mapping for passage keys. */
const SECTION_LABELS: Record<string, string> = {
  primary: "Primary Hexagram",
  relating: "Relating Hexagram",
  nuclear_primary: "Nuclear Hexagram (Primary)",
  nuclear_relating: "Nuclear Hexagram (Relating)",
};

function sectionLabel(key: string): string {
  if (SECTION_LABELS[key]) return SECTION_LABELS[key];
  if (key.startsWith("line_")) return `Changing Line ${key.replace("line_", "")}`;
  return key;
}

export default function TextPassagesResult({
  data,
  onNewConsultation,
}: TextPassagesResultProps) {
  const { cast, passages } = data;

  // Order sections: primary first, then lines in order, then relating, then nuclear
  const orderedKeys = Object.keys(passages).sort((a, b) => {
    const order = ["primary", "line_1", "line_2", "line_3", "line_4", "line_5", "line_6", "relating", "nuclear_primary", "nuclear_relating"];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Reference: #{cast.primary.king_wen} {cast.primary.name} / {cast.primary.title}
        </h2>
        {cast.relating && (
          <p className="text-sm text-muted mt-1">
            Relating: #{cast.relating.king_wen} {cast.relating.name} / {cast.relating.title}
          </p>
        )}
        {cast.changing_lines.length > 0 && (
          <p className="text-sm text-muted">
            Changing lines: {cast.changing_lines.join(", ")}
          </p>
        )}
      </div>

      {/* Passages by section */}
      {orderedKeys.map((key) => (
        <section key={key} className="space-y-3">
          <h3 className="font-heading text-lg font-semibold text-foreground border-b border-border/50 pb-1">
            {sectionLabel(key)}
          </h3>
          {passages[key].map((entry, i) => (
            <div
              key={i}
              className="p-4 rounded-lg bg-surface border border-border text-sm text-foreground leading-relaxed"
            >
              {entry.blocks && entry.blocks.length > 0 ? (
                entry.blocks.map((block: FormattedBlock, j: number) => {
                  if (block.type === "header") {
                    return (
                      <h4
                        key={j}
                        className="font-heading text-base font-semibold text-foreground mt-4 first:mt-0 mb-1"
                      >
                        {block.content}
                      </h4>
                    );
                  }
                  return (
                    <p key={j} className="mb-2 last:mb-0">
                      {block.content}
                    </p>
                  );
                })
              ) : (
                <span className="whitespace-pre-wrap">{entry.text}</span>
              )}
              {entry.source && (
                <p className="mt-3 text-xs text-muted italic border-t border-border/30 pt-2">
                  Source: {entry.source}
                </p>
              )}
            </div>
          ))}
        </section>
      ))}

      {Object.keys(passages).length === 0 && (
        <p className="text-sm text-muted italic">
          No passages found. The collection may not contain content for this hexagram.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <button
          onClick={onNewConsultation}
          className="px-6 py-2.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          New Consultation
        </button>
      </div>
    </div>
  );
}
