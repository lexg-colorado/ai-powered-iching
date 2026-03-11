"use client";

import { useMemo } from "react";
import type { ClientCastResult } from "@/lib/hexagram";
import { LINE_INFO } from "@/lib/hexagram";
import HexagramDisplay from "./HexagramDisplay";
import type { LineValue } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { wrapCollapsibleSections } from "@/lib/markdownTransform";

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

      {/* Cast details */}
      <div className="space-y-3">
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
    </div>
  );
}
