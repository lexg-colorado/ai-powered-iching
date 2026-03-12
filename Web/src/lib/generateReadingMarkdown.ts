/**
 * Generate a complete Markdown document from a reading.
 *
 * Pure function: reading data in, markdown string out.
 */

import type { ClientCastResult } from "@/lib/hexagram";
import { LINE_INFO } from "@/lib/hexagram";

export function generateReadingMarkdown(opts: {
  castResult: ClientCastResult;
  interpretation: string;
  question?: string;
}): string {
  const { castResult, interpretation, question } = opts;
  const { primary, relating, nuclear, zongGua, changingLines, lineValues } =
    castResult;

  const lines: string[] = [];

  lines.push("# I Ching Reading");
  lines.push("");
  lines.push(
    `**Date:** ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
  );
  lines.push("");

  // Question
  if (question) {
    lines.push("## Question");
    lines.push("");
    lines.push(question);
    lines.push("");
  }

  // Cast details
  lines.push("## Cast");
  lines.push("");
  lines.push(
    `**Primary Hexagram:** #${primary.king_wen} ${primary.name} / ${primary.title}`,
  );
  if (relating) {
    lines.push(
      `**Relating Hexagram:** #${relating.king_wen} ${relating.name} / ${relating.title}`,
    );
  }
  if (nuclear) {
    lines.push(
      `**Nuclear Hexagram:** #${nuclear.king_wen} ${nuclear.name} / ${nuclear.title}`,
    );
  }
  if (zongGua) {
    lines.push(
      `**Zong Gua:** #${zongGua.king_wen} ${zongGua.name} / ${zongGua.title}`,
    );
  }
  lines.push("");

  // Line breakdown
  lines.push("### Lines");
  lines.push("");
  lines.push("```");
  for (const lineNum of [6, 5, 4, 3, 2, 1]) {
    const val = lineValues[lineNum - 1] as 6 | 7 | 8 | 9;
    const info = LINE_INFO[val];
    const isChanging = changingLines.includes(lineNum);
    lines.push(
      `Line ${lineNum}: ${info.symbol}  (${info.name})${isChanging ? "  <-" : ""}`,
    );
  }
  lines.push("```");
  lines.push("");

  if (changingLines.length > 0 && relating) {
    lines.push(
      `Changing lines: ${changingLines.join(", ")} → #${relating.king_wen} ${relating.name} / ${relating.title}`,
    );
    lines.push("");
  }

  // Interpretation
  lines.push("---");
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push(interpretation);

  return lines.join("\n");
}
