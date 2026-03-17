/**
 * Transform LLM-generated markdown to wrap Nuclear Hexagram and Zong Gua
 * sections in <details>/<summary> elements for collapsible rendering.
 *
 * Only applied AFTER streaming completes to avoid flicker and re-render issues.
 */

// Matches headings like:
//   ### Nuclear Hexagram of Primary (23): ...
//   ### Zong Gua (Complement) (44): ...
//   ## Nuclear Hexagram ...
//   ### The Nuclear Hexagram ...
const COLLAPSIBLE_HEADING_RE =
  /^(#{2,3})\s+(?:The\s+)?(?:Nuclear Hexagram|Zong Gua)(.*)$/gm;

// Matches any ## or ### heading (used to find section boundaries)
const ANY_HEADING_RE = /^#{2,3}\s/gm;

export function wrapCollapsibleSections(markdown: string): string {
  // Find all matching headings with their positions
  const matches: {
    index: number;
    fullMatch: string;
    heading: string;
  }[] = [];

  let m: RegExpExecArray | null;
  COLLAPSIBLE_HEADING_RE.lastIndex = 0;

  while ((m = COLLAPSIBLE_HEADING_RE.exec(markdown)) !== null) {
    matches.push({
      index: m.index,
      fullMatch: m[0],
      heading: m[0].replace(/^#+\s*/, ""),
    });
  }

  if (matches.length === 0) return markdown;

  // Find ALL heading positions so we can use them as boundaries
  const allHeadingPositions: number[] = [];
  ANY_HEADING_RE.lastIndex = 0;
  while ((m = ANY_HEADING_RE.exec(markdown)) !== null) {
    allHeadingPositions.push(m.index);
  }

  // Build replacement segments from the original string (forward order)
  // Each collapsible section runs from its heading to the next heading (or EOF)
  const segments: { start: number; end: number; heading: string }[] = [];

  for (const match of matches) {
    const contentStart = match.index + match.fullMatch.length;

    // Find the next heading AFTER this match's content starts
    const nextHeadingPos = allHeadingPositions.find(
      (pos) => pos > match.index && pos >= contentStart,
    );
    const sectionEnd = nextHeadingPos ?? markdown.length;

    segments.push({
      start: match.index,
      end: sectionEnd,
      heading: match.heading,
    });
  }

  // Build result by replacing segments from last to first (preserves indices)
  let result = markdown;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const contentStart = seg.start + matches[i].fullMatch.length;
    const sectionContent = result.slice(contentStart, seg.end).trim();

    const replacement =
      `<details class="collapsible-section">\n<summary>${seg.heading}</summary>\n\n${sectionContent}\n\n</details>\n\n`;

    result = result.slice(0, seg.start) + replacement + result.slice(seg.end);
  }

  return result;
}
