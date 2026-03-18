"use client";

import { useMemo, useCallback } from "react";
import type { ClientCastResult } from "@/lib/hexagram";
import { LINE_INFO } from "@/lib/hexagram";
import { generateReadingMarkdown } from "@/lib/generateReadingMarkdown";
import HexagramDisplay from "./HexagramDisplay";
import type { LineValue } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { wrapCollapsibleSections } from "@/lib/markdownTransform";
import { getElementsForHexagram, getCompassTrigram } from "@/lib/wheelRelationships";
import MiniWheel from "./MiniWheel";

interface ReadingResultProps {
  castResult: ClientCastResult;
  interpretation: string;
  question?: string;
  onNewConsultation: () => void;
  isStreaming?: boolean;
}

export default function ReadingResult({
  castResult,
  interpretation,
  question,
  onNewConsultation,
  isStreaming = false,
}: ReadingResultProps) {
  const { primary, relating, changingLines, nuclear } = castResult;

  // Compute relating line values for display
  const relatingLines: (LineValue | null)[] = castResult.lineValues.map(
    (val) => {
      if (val === 9) return 8;
      if (val === 6) return 7;
      return val as LineValue;
    }
  );

  const handleDownload = useCallback(() => {
    const markdown = generateReadingMarkdown({
      castResult,
      interpretation,
      question,
    });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = primary.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    a.download = `iching-reading-${primary.king_wen}-${slug}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [castResult, interpretation, question, primary]);

  // Only apply collapsible transform after streaming completes to avoid flicker
  const processedInterpretation = useMemo(() => {
    if (!interpretation) return "";
    if (isStreaming) return interpretation;
    return wrapCollapsibleSections(interpretation);
  }, [interpretation, isStreaming]);

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {question && (
        <div className="font-heading text-base italic text-yang">
          Question: {question}
        </div>
      )}

      {/* Hexagram symbols */}
      <div className="flex items-center justify-center gap-8 py-8 px-6 border border-border rounded-xl bg-surface">
        <div className="flex flex-col items-center gap-2 w-36">
          <HexagramDisplay
            lineValues={castResult.lineValues as (LineValue | null)[]}
            label=""
            showLineNumbers={false}
          />
          <span className="font-heading text-xl font-bold text-foreground mt-2">
            {primary.king_wen}
          </span>
          <span className="font-heading text-base font-semibold text-foreground">
            {primary.name}
          </span>
          <span className="text-xs text-muted">
            {primary.title}
          </span>
        </div>

        {relating && (
          <>
            <div className="text-muted text-sm italic font-heading">
              changing to
            </div>
            <div className="flex flex-col items-center gap-2 w-36">
              <HexagramDisplay
                lineValues={relatingLines}
                label=""
                showLineNumbers={false}
              />
              <span className="font-heading text-xl font-bold text-foreground mt-2">
                {relating.king_wen}
              </span>
              <span className="font-heading text-base font-semibold text-foreground">
                {relating.name}
              </span>
              <span className="text-xs text-muted">
                {relating.title}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Cast details + mini wheel */}
      <div className="flex gap-12 items-center justify-center">
        <div className="space-y-3 max-w-md">
        <h3 className="font-heading text-lg font-semibold text-foreground">
          Primary: {primary.king_wen}. {primary.name} / {primary.title}
        </h3>
        {relating && (
          <h3 className="font-heading text-lg font-semibold text-yin">
            Relating: {relating.king_wen}. {relating.name} / {relating.title}
          </h3>
        )}

        {/* Line-by-line breakdown */}
        <div className="font-mono text-xs space-y-0.5 text-muted mt-2">
          {[6, 5, 4, 3, 2, 1].map((lineNum) => {
            const val = castResult.lineValues[lineNum - 1] as LineValue;
            const info = LINE_INFO[val];
            const isChange = changingLines.includes(lineNum);
            return (
              <div
                key={lineNum}
                className={isChange ? "text-changing font-semibold" : ""}
              >
                Line {lineNum}: {info.symbol} ({info.name})
                {isChange ? "  <-" : ""}
              </div>
            );
          })}
        </div>

        {relating && (
          <p className="text-sm text-muted mt-2">
            Changing lines: {changingLines.join(", ")} &rarr;{" "}
            <span className="font-semibold text-foreground">
              #{relating.king_wen} {relating.name} / {relating.title}
            </span>
          </p>
        )}

        {nuclear && (
          <p className="text-xs text-muted mt-1">
            Nuclear: #{nuclear.king_wen} {nuclear.name} / {nuclear.title}
          </p>
        )}
        {castResult.zongGua && (
          <p className="text-xs text-muted mt-1">
            Zong Gua: #{castResult.zongGua.king_wen} {castResult.zongGua.name} / {castResult.zongGua.title}
          </p>
        )}

        {/* Element and compass direction */}
        {(() => {
          const upperBits = primary.binary.slice(0, 3);
          const lowerBits = primary.binary.slice(3, 6);
          const upper = getCompassTrigram("later", upperBits);
          const lower = getCompassTrigram("later", lowerBits);
          const elements = getElementsForHexagram(primary.king_wen);
          const elementColors: Record<string, string> = {
            Fire: "#c4420a", Earth: "#b8860b", Metal: "#9ca3af", Water: "#2563eb", Wood: "#4a8b3f",
          };

          return (
            <div className="flex gap-4 mt-2">
              {elements.length > 0 && (
                <p className="text-xs text-muted">
                  Element: {elements.map((el, i) => (
                    <span key={el}>
                      {i > 0 && ", "}
                      <span className="font-medium" style={{ color: elementColors[el] }}>{el}</span>
                    </span>
                  ))}
                </p>
              )}
              {upper && lower && (
                <p className="text-xs text-muted">
                  Direction: {upper.direction} (upper) · {lower.direction} (lower)
                </p>
              )}
            </div>
          );
        })()}
        </div>

        {/* Mini wheel — position in King Wen sequence */}
        <div className="hidden sm:flex flex-shrink-0 items-center">
          <MiniWheel
            primaryKingWen={primary.king_wen}
            relatingKingWen={relating?.king_wen}
            size={220}
          />
        </div>
      </div>

      {/* Interpretation */}
      <div className="border-t border-border pt-6">
        <h3 className="font-heading text-xl font-semibold text-foreground mb-4">
          Reading Interpretation
        </h3>
        <div className="prose prose-neutral max-w-none text-foreground/90 text-base leading-relaxed">
          {processedInterpretation ? (
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ children }) => <h1 className="font-heading">{children}</h1>,
                h2: ({ children }) => <h2 className="font-heading">{children}</h2>,
                h3: ({ children }) => <h3 className="font-heading">{children}</h3>,
                details: ({ children }) => (
                  <details className="my-4 border border-border rounded-lg overflow-hidden">
                    {children}
                  </details>
                ),
                summary: ({ children }) => (
                  <summary className="cursor-pointer px-4 py-2 bg-surface hover:bg-surface/80 font-heading text-sm font-semibold text-muted select-none">
                    {children}
                  </summary>
                ),
              }}
            >
              {processedInterpretation}
            </ReactMarkdown>
          ) : isStreaming ? (
            <p className="text-muted italic">Consulting the oracle...</p>
          ) : null}
          {isStreaming && interpretation && (
            <span className="inline-block w-2 h-4 bg-yang/70 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      </div>

      {/* New consultation */}
      <button
        onClick={onNewConsultation}
        className="self-start px-5 py-2.5 text-sm font-medium text-accent hover:bg-surface rounded-lg transition-colors border border-border"
      >
        New Consultation
      </button>

      {/* Floating download button */}
      {!isStreaming && interpretation && (
        <button
          onClick={handleDownload}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-surface border border-border shadow-lg text-muted hover:text-yang hover:border-yang transition-colors"
          aria-label="Download reading as Markdown"
          title="Download reading as .md"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      )}
    </div>
  );
}
