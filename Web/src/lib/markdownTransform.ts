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

export function wrapCollapsibleSections(markdown: string): string {
  // Find all matching headings with their positions
  const matches: {
    index: number;
    fullMatch: string;
    level: number;
    heading: string;
  }[] = [];

  let m: RegExpExecArray | null;
  COLLAPSIBLE_HEADING_RE.lastIndex = 0;

  while ((m = COLLAPSIBLE_HEADING_RE.exec(markdown)) !== null) {
    matches.push({
      index: m.index,
      fullMatch: m[0],
      level: m[1].length, // 2 for ##, 3 for ###
      heading: m[0].replace(/^#+\s*/, ""),
    });
  }

  if (matches.length === 0) return markdown;

  // Process from last to first to preserve string indices
  let result = markdown;

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const sectionStart = match.index;
    const contentStart = sectionStart + match.fullMatch.length;

    // Find the end of this section: next heading of same or higher level
    const afterContent = result.slice(contentStart);
    const nextHeadingRe = new RegExp(`^#{1,${match.level}}\\s`, "m");
    const nextMatch = nextHeadingRe.exec(afterContent);
    const sectionEnd = nextMatch
      ? contentStart + nextMatch.index
      : result.length;

    const sectionContent = result.slice(contentStart, sectionEnd).trim();

    const replacement =
      `<details class="collapsible-section">\n<summary>${match.heading}</summary>\n\n${sectionContent}\n\n</details>\n\n`;

    result =
      result.slice(0, sectionStart) + replacement + result.slice(sectionEnd);
  }

  return result;
}
