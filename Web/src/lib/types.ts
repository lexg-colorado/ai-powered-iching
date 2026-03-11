/** TypeScript types matching the Python dataclasses and API models. */

export interface HexagramData {
  king_wen: number;
  name: string;
  title: string;
  binary: string;
  upper_trigram: string;
  lower_trigram: string;
}

export interface CastResponse {
  line_values: number[];
  primary: HexagramData;
  changing_lines: number[];
  relating: HexagramData | null;
  change_mask: string;
  nuclear: HexagramData | null;
}

export interface ReadingRequest {
  line_values: number[];
  question?: string | null;
  collection?: string | null;
}

export interface ReadingResponse {
  cast: CastResponse;
  interpretation: string;
  header: string;
}

export interface SingleTossResponse {
  coins: string[];
  total: number;
}

export interface HealthStatus {
  lm_studio: boolean;
  chromadb: boolean;
  models: string[];
  collections?: string[];
}

export interface CollectionInfo {
  name: string;
  metadata: Record<string, unknown>;
  count: number;
}

/** Line value: 6=old yin, 7=young yang, 8=young yin, 9=old yang */
export type LineValue = 6 | 7 | 8 | 9;

export interface LineInfo {
  name: string;
  symbol: string;
  isChanging: boolean;
}

export interface TossResult {
  lineNumber: number;
  coins: ("H" | "T")[];
  total: LineValue;
  name: string;
  isChanging: boolean;
}

/** The eight trigrams: 3-bit binary -> (name, attribute) */
export interface TrigramInfo {
  name: string;
  attribute: string;
}

export interface FormattedBlock {
  type: "header" | "paragraph";
  content: string;
}

export interface PassageEntry {
  text: string;
  blocks?: FormattedBlock[] | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface TextPassagesResponse {
  cast: CastResponse;
  passages: Record<string, PassageEntry[]>;
}

export type InputMode = "cast" | "manual" | "number";
