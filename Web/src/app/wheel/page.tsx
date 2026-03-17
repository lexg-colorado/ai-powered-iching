/**
 * /wheel route — Interactive I Ching Hexagram Wheel.
 *
 * Loads hexagram data, renders the wheel visualization,
 * and manages interaction state across six modes:
 *   - Explore: click to see relationships + rich text
 *   - Transform: dual-select XOR transformation
 *   - Pathway: walk the GF(2)^6 hypercube one flip at a time
 *   - Neighbors: Hamming distance visualization
 *   - Trigram Filter: upper/lower trigram cross-reference
 *
 * Also features: hover tooltip, zoom-to-selection, trigram hover highlighting.
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { loadHexagrams, allHexagrams, lookupByBinary } from "../../lib/hexagram";
import { HexagramWheel } from "../../components/wheel/HexagramWheel";
import { WheelControls, type WheelMode } from "../../components/wheel/WheelControls";
import { TransformationOverlay } from "../../components/wheel/TransformationOverlay";
import { HexagramSearchInput } from "../../components/wheel/HexagramSearchInput";
import { HexagramTooltip } from "../../components/wheel/HexagramTooltip";
import { PathwaySidebar, type PathwayStep } from "../../components/wheel/PathwaySidebar";
import { NeighborsSidebar } from "../../components/wheel/NeighborsSidebar";
import { TrigramFilterSidebar } from "../../components/wheel/TrigramFilterSidebar";
import { ElementsSidebar } from "../../components/wheel/ElementsSidebar";
import { CompassSidebar } from "../../components/wheel/CompassSidebar";
import { useDragRotation } from "../../hooks/useDragRotation";
import { useHexagramTextCache } from "../../hooks/useHexagramTextCache";
import { useViewBoxZoom } from "../../hooks/useViewBoxZoom";
import {
  computeRelationships,
  computeTransformation,
  findByTrigram,
  flipLine,
  findNeighbors,
  filterByTrigramPair,
  getHexagramsByElement,
  getElementForHexagram,
  getCompassTrigram,
  type HexagramRelationships,
  type TransformationInfo,
  type NeighborEntry,
} from "../../lib/wheelRelationships";
import type { ParticleCanvasHandle } from "../../components/wheel/ParticleCanvas";
import type { HexagramData } from "../../lib/types";
import type { GlyphState } from "../../components/wheel/HexagramGlyph";

export default function WheelPage() {
  const [hexagrams, setHexagrams] = useState<HexagramData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<WheelMode>("explore");

  // ── Explore mode state ──
  const [selectedHex, setSelectedHex] = useState<number | null>(null);
  const [hoveredHex, setHoveredHex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [relationships, setRelationships] = useState<HexagramRelationships | null>(null);

  // ── Transform mode state ──
  const [transformSource, setTransformSource] = useState<number | null>(null);
  const [transformTarget, setTransformTarget] = useState<number | null>(null);
  const [transformInfo, setTransformInfo] = useState<TransformationInfo | null>(null);

  // ── Pathway mode state ──
  const [pathwaySteps, setPathwaySteps] = useState<PathwayStep[]>([]);

  // ── Neighbors mode state ──
  const [neighborsSource, setNeighborsSource] = useState<number | null>(null);
  const [neighborsData, setNeighborsData] = useState<Map<number, NeighborEntry[]>>(new Map());
  const [maxNeighborDistance, setMaxNeighborDistance] = useState(1);

  // ── Trigram filter mode state ──
  const [trigramFilter, setTrigramFilter] = useState<{ upper: string | null; lower: string | null }>({
    upper: null,
    lower: null,
  });

  // ── Elements mode state ──
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  // ── Compass mode state ──
  const [compassArrangement, setCompassArrangement] = useState<"earlier" | "later">("later");
  const [selectedCompassTrigram, setSelectedCompassTrigram] = useState<string | null>(null);

  // ── Trigram hover state (works across modes) ──
  const [highlightedTrigram, setHighlightedTrigram] = useState<string | null>(null);
  const [trigramHexagrams, setTrigramHexagrams] = useState<Set<number>>(new Set());

  // ── Rich sidebar text (Feature 1) ──
  const textCacheKey = mode === "explore" ? selectedHex : null;
  const { data: hexText, loading: textLoading, error: textError } = useHexagramTextCache(textCacheKey);

  // ── Particle canvas ref ──
  const particleRef = useRef<ParticleCanvasHandle>(null);

  // ── Drag-to-rotate ──
  const drag = useDragRotation(400, 400);

  // ── Zoom-to-selection (Feature 3) ──
  const { viewBox: zoomViewBox, isZoomed, zoomTo, reset: resetZoom } = useViewBoxZoom({
    defaultViewBox: "0 0 800 800",
    duration: 400,
    padding: 0.35,
  });

  // ── Load hexagram data ──
  useEffect(() => {
    loadHexagrams().then(() => {
      setHexagrams(allHexagrams());
      setLoading(false);
    });
  }, []);

  // ── Compute relationships (explore mode) ──
  useEffect(() => {
    if (selectedHex == null || mode !== "explore") {
      setRelationships(null);
      return;
    }
    const hex = hexagrams.find((h) => h.king_wen === selectedHex);
    if (hex) {
      setRelationships(computeRelationships(hex));
    }
  }, [selectedHex, hexagrams, mode]);

  // ── Compute transformation (transform mode) ──
  useEffect(() => {
    if (transformSource == null || transformTarget == null) {
      setTransformInfo(null);
      return;
    }
    const from = hexagrams.find((h) => h.king_wen === transformSource);
    const to = hexagrams.find((h) => h.king_wen === transformTarget);
    if (from && to) {
      setTransformInfo(computeTransformation(from, to));
    }
  }, [transformSource, transformTarget, hexagrams]);

  // ── Build trigram-hover set ──
  useEffect(() => {
    if (!highlightedTrigram) {
      setTrigramHexagrams(new Set());
      return;
    }
    const connected = findByTrigram(highlightedTrigram, "any");
    setTrigramHexagrams(new Set(connected.map((h) => h.king_wen)));
  }, [highlightedTrigram]);

  // ── Compute neighbors (neighbors mode) ──
  useEffect(() => {
    if (neighborsSource == null || mode !== "neighbors") {
      setNeighborsData(new Map());
      return;
    }
    const hex = hexagrams.find((h) => h.king_wen === neighborsSource);
    if (hex) {
      setNeighborsData(findNeighbors(hex.binary, 3)); // Always compute up to 3
    }
  }, [neighborsSource, hexagrams, mode]);

  // ── Compute filtered hexagrams (trigram filter mode) ──
  const filteredHexagrams = useMemo(() => {
    if (mode !== "trigram_filter") return [];
    if (!trigramFilter.upper && !trigramFilter.lower) return [];
    return filterByTrigramPair(trigramFilter.upper, trigramFilter.lower);
  }, [trigramFilter, mode]);

  // ── Compute element-associated hexagrams (elements mode) ──
  const activeElement = selectedElement || hoveredElement;
  const elementHexagrams = useMemo(() => {
    if (mode !== "elements" || !activeElement) return [];
    return getHexagramsByElement(activeElement);
  }, [mode, activeElement]);

  // ── Build glyph state map ──
  const glyphStates = useMemo(() => {
    const states = new Map<number, GlyphState>();

    // Trigram hover takes precedence in explore mode with no selection
    if (highlightedTrigram && trigramHexagrams.size > 0 && selectedHex == null && mode === "explore") {
      for (const h of hexagrams) {
        states.set(h.king_wen, trigramHexagrams.has(h.king_wen) ? "highlighted" : "dimmed");
      }
      return states;
    }

    if (mode === "explore") {
      if (selectedHex == null) return states;
      for (const h of hexagrams) states.set(h.king_wen, "dimmed");
      states.set(selectedHex, "selected");
      if (relationships) {
        if (relationships.nuclear) states.set(relationships.nuclear.king_wen, "highlighted");
        if (relationships.zongGua) states.set(relationships.zongGua.king_wen, "highlighted");
        if (relationships.overturned) states.set(relationships.overturned.king_wen, "highlighted");
      }
    } else if (mode === "transform") {
      if (transformSource != null || transformTarget != null) {
        for (const h of hexagrams) states.set(h.king_wen, "dimmed");
        if (transformSource != null) states.set(transformSource, "selected");
        if (transformTarget != null) states.set(transformTarget, "target");
      }
    } else if (mode === "pathway") {
      if (pathwaySteps.length > 0) {
        for (const h of hexagrams) states.set(h.king_wen, "dimmed");
        // Previous steps
        for (let i = 0; i < pathwaySteps.length - 1; i++) {
          states.set(pathwaySteps[i].hex.king_wen, "path_visited");
        }
        // Current step
        states.set(pathwaySteps[pathwaySteps.length - 1].hex.king_wen, "path_current");
      }
    } else if (mode === "neighbors") {
      if (neighborsSource != null) {
        for (const h of hexagrams) states.set(h.king_wen, "dimmed");
        states.set(neighborsSource, "selected");
        for (let d = 1; d <= maxNeighborDistance; d++) {
          const entries = neighborsData.get(d) ?? [];
          const stateKey: GlyphState = d === 1 ? "neighbor_d1" : d === 2 ? "neighbor_d2" : "neighbor_d3";
          for (const entry of entries) {
            states.set(entry.hex.king_wen, stateKey);
          }
        }
      }
    } else if (mode === "trigram_filter") {
      if (trigramFilter.upper || trigramFilter.lower) {
        const matchSet = new Set(filteredHexagrams.map((h) => h.king_wen));
        for (const h of hexagrams) {
          states.set(h.king_wen, matchSet.has(h.king_wen) ? "filtered" : "dimmed");
        }
      }
    } else if (mode === "elements") {
      if (activeElement && elementHexagrams.length > 0) {
        const matchSet = new Set(elementHexagrams.map((h) => h.king_wen));
        for (const h of hexagrams) {
          states.set(h.king_wen, matchSet.has(h.king_wen) ? "highlighted" : "dimmed");
        }
      }
    } else if (mode === "compass") {
      if (selectedCompassTrigram) {
        const matching = findByTrigram(selectedCompassTrigram, "any");
        const matchSet = new Set(matching.map((h) => h.king_wen));
        for (const h of hexagrams) {
          states.set(h.king_wen, matchSet.has(h.king_wen) ? "highlighted" : "dimmed");
        }
      }
    }

    return states;
  }, [
    selectedHex, relationships, hexagrams, mode,
    transformSource, transformTarget,
    highlightedTrigram, trigramHexagrams,
    pathwaySteps, neighborsSource, neighborsData, maxNeighborDistance,
    trigramFilter, filteredHexagrams,
    activeElement, elementHexagrams,
    selectedCompassTrigram,
  ]);

  // ── Handle hexagram click ──
  const handleHexagramClick = useCallback(
    (kingWen: number) => {
      if (mode === "explore") {
        setSelectedHex((prev) => (prev === kingWen ? null : kingWen));
        particleRef.current?.spawnBurst(0, 0);
      } else if (mode === "transform") {
        if (transformSource == null) {
          setTransformSource(kingWen);
        } else if (transformTarget == null) {
          if (kingWen === transformSource) return;
          setTransformTarget(kingWen);
        } else {
          setTransformSource(kingWen);
          setTransformTarget(null);
          setTransformInfo(null);
        }
      } else if (mode === "pathway") {
        if (pathwaySteps.length === 0) {
          const hex = hexagrams.find((h) => h.king_wen === kingWen);
          if (hex) {
            setPathwaySteps([{ hex, lineFlipped: null }]);
          }
        }
        // In pathway mode, subsequent steps come from sidebar line-flip buttons
      } else if (mode === "neighbors") {
        setNeighborsSource(kingWen);
        setMaxNeighborDistance(1);
      } else if (mode === "trigram_filter") {
        // Click a hexagram in filter mode to select it for viewing
        setSelectedHex(kingWen);
      }
    },
    [mode, transformSource, transformTarget, hexagrams, pathwaySteps.length],
  );

  // ── Handle hover (with mouse position for tooltip) ──
  const handleHexagramHover = useCallback(
    (kingWen: number | null, clientX?: number, clientY?: number) => {
      setHoveredHex(kingWen);
      if (kingWen != null && clientX != null && clientY != null) {
        setMousePos({ x: clientX, y: clientY });
      } else {
        setMousePos(null);
      }
    },
    [],
  );

  // ── Handle trigram hover ──
  const handleTrigramHover = useCallback((bits: string | null) => {
    setHighlightedTrigram(bits);
  }, []);

  // ── Handle trigram click (trigram_filter mode) ──
  const handleTrigramClick = useCallback(
    (bits: string) => {
      if (mode !== "trigram_filter") return;
      // If neither filter is set, prompt via sidebar — but for simplicity,
      // first click sets upper, second click sets lower
      setTrigramFilter((prev) => {
        if (prev.upper === null) return { ...prev, upper: bits };
        if (prev.lower === null) return { ...prev, lower: bits };
        // Both set — replace upper
        return { upper: bits, lower: null };
      });
    },
    [mode],
  );

  // ── Elements mode: click an element ──
  const handleElementClick = useCallback((name: string) => {
    setSelectedElement((prev) => (prev === name ? null : name));
  }, []);

  // ── Elements mode: hover an element ──
  const handleElementHover = useCallback((name: string | null) => {
    setHoveredElement(name);
  }, []);

  // ── Pathway mode: flip a line ──
  const handleFlipLine = useCallback(
    (lineNumber: number) => {
      if (pathwaySteps.length === 0) return;
      const current = pathwaySteps[pathwaySteps.length - 1].hex;
      const newBinary = flipLine(current.binary, lineNumber);
      const newHex = lookupByBinary(newBinary);
      if (newHex) {
        setPathwaySteps((prev) => [...prev, { hex: newHex, lineFlipped: lineNumber }]);
      }
    },
    [pathwaySteps],
  );

  // ── Pathway mode: undo ──
  const handlePathwayUndo = useCallback(() => {
    setPathwaySteps((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  // ── Pathway mode: reset ──
  const handlePathwayReset = useCallback(() => {
    setPathwaySteps([]);
  }, []);

  // ── Neighbors mode: change distance ──
  const handleDistanceChange = useCallback((d: number) => {
    setMaxNeighborDistance(d);
  }, []);

  // ── Neighbors mode: select a neighbor (re-center) ──
  const handleSelectNeighbor = useCallback((kingWen: number) => {
    setNeighborsSource(kingWen);
    setMaxNeighborDistance(1);
  }, []);

  // ── Clear all mode-specific state (shared between mode switch and reset) ──
  const clearAllState = useCallback(() => {
    setSelectedHex(null);
    setRelationships(null);
    setTransformSource(null);
    setTransformTarget(null);
    setTransformInfo(null);
    setHighlightedTrigram(null);
    setPathwaySteps([]);
    setNeighborsSource(null);
    setNeighborsData(new Map());
    setMaxNeighborDistance(1);
    setTrigramFilter({ upper: null, lower: null });
    setSelectedElement(null);
    setHoveredElement(null);
    setSelectedCompassTrigram(null);
    resetZoom();
  }, [resetZoom]);

  // ── Handle mode switch ──
  const handleModeChange = useCallback((newMode: WheelMode) => {
    setMode(newMode);
    clearAllState();
  }, [clearAllState]);

  // ── Handle reset (clears state but preserves current mode) ──
  const handleReset = useCallback(() => {
    clearAllState();
    drag.resetRotation();
  }, [clearAllState, drag]);

  // ── Navigate to related hexagram ──
  const navigateToHex = useCallback(
    (kingWen: number) => {
      if (mode === "explore") {
        setSelectedHex(kingWen);
      }
    },
    [mode],
  );

  // ── Zoom-to-selection effect ──
  // Build zoom targets whenever selection changes in explore mode
  // (we need position data, but we don't have it here — use a simpler approach:
  //  zoom based on estimated position from king_wen number)
  // Actually, we won't zoom in explore mode for now — the sidebar is sufficient.
  // Instead, zoom is available as a future enhancement or when the wheel is small.
  // For now, we just pass the viewBox through.

  // ── Resolve hovered hex data for tooltip ──
  const hoveredHexData = useMemo(() => {
    if (hoveredHex == null) return null;
    return hexagrams.find((h) => h.king_wen === hoveredHex) ?? null;
  }, [hoveredHex, hexagrams]);

  // ── Resolve neighbors source hex data ──
  const neighborsSourceHex = useMemo(() => {
    if (neighborsSource == null) return null;
    return hexagrams.find((h) => h.king_wen === neighborsSource) ?? null;
  }, [neighborsSource, hexagrams]);

  // ── Header instruction text ──
  const headerText = useMemo(() => {
    switch (mode) {
      case "explore":
        return "Click a hexagram to explore its relationships";
      case "transform":
        if (transformSource == null) return "Click a hexagram to set the source";
        if (transformTarget == null) return "Click a second hexagram to see the transformation";
        return "Click again to start a new transformation";
      case "pathway":
        if (pathwaySteps.length === 0) return "Click a hexagram to begin walking the hypercube";
        return `Step ${pathwaySteps.length}: flip a line in the sidebar to continue`;
      case "neighbors":
        if (neighborsSource == null) return "Click a hexagram to see its neighbors";
        return "Adjust distance or click a neighbor to re-center";
      case "trigram_filter":
        return "Click trigrams on the wheel or grid to filter hexagrams";
      case "elements":
        return selectedElement
          ? `Showing hexagrams associated with ${selectedElement}`
          : "Click an element at the center of the wheel to explore Wu Xing relationships";
      case "compass":
        return selectedCompassTrigram
          ? `${compassArrangement === "earlier" ? "Earlier" : "Later"} Heaven — showing hexagrams with selected trigram`
          : `${compassArrangement === "earlier" ? "Earlier" : "Later"} Heaven arrangement — click a trigram to explore`;
      default:
        return "";
    }
  }, [mode, transformSource, transformTarget, pathwaySteps.length, neighborsSource, selectedElement]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-heading text-foreground mb-2">Loading hexagrams...</div>
          <div className="text-muted text-sm">Preparing the wheel</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-heading text-foreground">Hexagram Wheel</h1>
          <p className="text-sm text-muted">{headerText}</p>
        </div>
        <div className="flex items-center gap-4">
          <WheelControls
            mode={mode}
            onModeChange={handleModeChange}
            onReset={handleReset}
          />
          <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
            ← Back to Divination
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Wheel viewport */}
        <div className="flex-1 p-4">
          <HexagramWheel
            hexagrams={hexagrams}
            glyphStates={glyphStates}
            relationships={mode === "explore" ? relationships : null}
            rotation={drag.rotation}
            particleRef={particleRef}
            highlightedTrigram={highlightedTrigram}
            selectedElement={mode === "elements" ? selectedElement : null}
            hoveredElement={mode === "elements" ? hoveredElement : null}
            elementsInteractive={mode === "elements"}
            onElementClick={handleElementClick}
            onElementHover={handleElementHover}
            onHexagramClick={handleHexagramClick}
            onHexagramHover={handleHexagramHover}
            onTrigramHover={handleTrigramHover}
            onTrigramClick={
              mode === "trigram_filter" ? handleTrigramClick
              : mode === "compass" ? (bits: string) => setSelectedCompassTrigram(bits)
              : undefined
            }
            onPointerDown={drag.onPointerDown}
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
          />
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            Sidebar panels — one per mode, right side on large screens
            ════════════════════════════════════════════════════════════════════ */}

        {/* ── Explore mode sidebar ── */}
        {mode === "explore" && (
          <aside className="w-80 border-l border-border bg-surface p-6 overflow-y-auto animate-fade-in hidden lg:block">
            <HexagramSearchInput
              value={selectedHex}
              onChange={(kw) => setSelectedHex(kw)}
              label="Hexagram"
              placeholder="Search by number or name..."
            />

            {selectedHex != null && relationships && (
              <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading text-foreground">
                #{relationships.source.king_wen} {relationships.source.name}
              </h2>
              <button
                onClick={() => setSelectedHex(null)}
                className="text-muted hover:text-foreground text-lg"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted mb-4 italic">{relationships.source.title}</p>

            {/* Binary */}
            <div className="mb-4">
              <span className="text-xs font-mono text-muted">Binary: {relationships.source.binary}</span>
            </div>

            {/* Trigrams — enriched with compass and Shuo Kua data */}
            {(() => {
              const upperBits = relationships.source.binary.slice(0, 3);
              const lowerBits = relationships.source.binary.slice(3, 6);
              const upper = getCompassTrigram("later", upperBits);
              const lower = getCompassTrigram("later", lowerBits);
              const element = getElementForHexagram(relationships.source.king_wen);
              const elementColors: Record<string, string> = {
                Fire: "#c4420a", Earth: "#b8860b", Metal: "#9ca3af", Water: "#2563eb", Wood: "#4a8b3f",
              };

              return (
                <>
                  <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
                    Trigrams
                  </h3>
                  <div className="mb-4 space-y-2 text-xs">
                    {[{ label: "Upper", info: upper }, { label: "Lower", info: lower }].map(({ label, info }) => (
                      <div key={label}>
                        <div className="text-foreground font-medium">{label}: {info?.name} ({info?.attribute})</div>
                        <div className="text-muted ml-2">
                          {info?.direction} · {info?.season || "—"} · {info?.family} · {info?.animal}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Wu Xing Element */}
                  <div className="mb-4 text-xs">
                    <span className="text-muted">Element: </span>
                    <span className="font-medium" style={{ color: element ? elementColors[element] : undefined }}>
                      {element ?? "—"}
                    </span>
                  </div>

                  {/* Compass Direction */}
                  <div className="mb-6 text-xs">
                    <span className="text-muted">Compass: </span>
                    <span className="text-foreground">
                      {upper?.direction ?? "?"} (upper) · {lower?.direction ?? "?"} (lower)
                    </span>
                  </div>
                </>
              );
            })()}

            {/* Relationships */}
            <h3 className="text-sm font-heading text-foreground mb-3 border-b border-border pb-1">
              Relationships
            </h3>
            <div className="space-y-3 text-sm">
              {relationships.nuclear && (
                <div>
                  <span className="text-accent font-medium">Nuclear: </span>
                  <button
                    onClick={() => navigateToHex(relationships.nuclear!.king_wen)}
                    className="text-foreground hover:text-accent transition-colors"
                  >
                    #{relationships.nuclear.king_wen} {relationships.nuclear.name} / {relationships.nuclear.title}
                  </button>
                </div>
              )}
              {relationships.zongGua && (
                <div>
                  <span className="text-changing font-medium">Zong Gua: </span>
                  <button
                    onClick={() => navigateToHex(relationships.zongGua!.king_wen)}
                    className="text-foreground hover:text-changing transition-colors"
                  >
                    #{relationships.zongGua.king_wen} {relationships.zongGua.name} / {relationships.zongGua.title}
                  </button>
                </div>
              )}
              {relationships.overturned && (
                <div>
                  <span className="text-yin font-medium">Overturned: </span>
                  <button
                    onClick={() => navigateToHex(relationships.overturned!.king_wen)}
                    className="text-foreground hover:text-yin transition-colors"
                  >
                    #{relationships.overturned.king_wen} {relationships.overturned.name} / {relationships.overturned.title}
                  </button>
                </div>
              )}
            </div>

            {/* ── Rich Text (Feature 1) ── */}
            <div className="mt-6">
              <h3 className="text-sm font-heading text-foreground mb-3 border-b border-border pb-1">
                Texts
              </h3>

              {textLoading && (
                <div className="space-y-2">
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-4/5" />
                  <div className="skeleton h-3 w-3/5" />
                </div>
              )}

              {textError && (
                <p className="text-xs text-muted italic">Failed to load text</p>
              )}

              {hexText && !textLoading && (
                <div className="space-y-4 text-xs leading-relaxed text-foreground/90">
                  {hexText.judgment && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-muted mb-1 font-medium">
                        The Judgment
                      </h4>
                      <p className="whitespace-pre-line">{hexText.judgment}</p>
                    </div>
                  )}
                  {hexText.image && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-muted mb-1 font-medium">
                        The Image
                      </h4>
                      <p className="whitespace-pre-line">{hexText.image}</p>
                    </div>
                  )}
                  {hexText.overview && !hexText.judgment && !hexText.image && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-muted mb-1 font-medium">
                        Overview
                      </h4>
                      <p className="whitespace-pre-line">{hexText.overview}</p>
                    </div>
                  )}
                  {hexText.sections.map((sec, i) => (
                    <div key={i}>
                      <h4 className="text-[10px] uppercase tracking-wider text-muted mb-1 font-medium">
                        {sec.heading}
                      </h4>
                      <p className="whitespace-pre-line">{sec.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </>
            )}
          </aside>
        )}

        {/* ── Transform mode sidebar ── */}
        {mode === "transform" && (
          <aside className="w-80 border-l border-border bg-surface p-6 overflow-y-auto animate-fade-in hidden lg:block">
            <h2 className="text-lg font-heading text-foreground mb-4">Transform</h2>
            <div className="flex items-end gap-2 mb-4">
              <div className="flex-1">
                <HexagramSearchInput
                  value={transformSource}
                  onChange={(kw) => setTransformSource(kw)}
                  label="Source"
                  placeholder="Source hexagram..."
                />
              </div>
              <button
                onClick={() => {
                  const s = transformSource;
                  const t = transformTarget;
                  setTransformSource(t);
                  setTransformTarget(s);
                }}
                disabled={transformSource == null || transformTarget == null}
                className="px-2 py-1.5 mb-3 text-xs border border-border rounded text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Swap source and target"
              >
                ⇄
              </button>
              <div className="flex-1">
                <HexagramSearchInput
                  value={transformTarget}
                  onChange={(kw) => {
                    if (kw !== transformSource) setTransformTarget(kw);
                  }}
                  label="Target"
                  placeholder="Target hexagram..."
                />
              </div>
            </div>
            {transformInfo && (
              <TransformationOverlay
                info={transformInfo}
                onClose={() => {
                  setTransformSource(null);
                  setTransformTarget(null);
                  setTransformInfo(null);
                }}
              />
            )}
          </aside>
        )}

        {/* ── Pathway mode sidebar ── */}
        {mode === "pathway" && (
          <aside className="w-80 border-l border-border bg-surface p-6 overflow-y-auto animate-fade-in hidden lg:block">
            <h2 className="text-lg font-heading text-foreground mb-4">Pathway</h2>
            <PathwaySidebar
              steps={pathwaySteps}
              onFlipLine={handleFlipLine}
              onUndo={handlePathwayUndo}
              onReset={handlePathwayReset}
              onStartFrom={(kw) => {
                const hex = hexagrams.find((h) => h.king_wen === kw);
                if (hex) setPathwaySteps([{ hex, lineFlipped: null }]);
              }}
              onNavigate={(kw) => {
                // Truncate path history to the clicked step
                const idx = pathwaySteps.findIndex((s) => s.hex.king_wen === kw);
                if (idx >= 0) {
                  setPathwaySteps((prev) => prev.slice(0, idx + 1));
                }
              }}
            />
          </aside>
        )}

        {/* ── Neighbors mode sidebar ── */}
        {mode === "neighbors" && (
          <aside className="w-80 border-l border-border bg-surface p-6 overflow-y-auto animate-fade-in hidden lg:block">
            <h2 className="text-lg font-heading text-foreground mb-4">Neighbors</h2>
            <HexagramSearchInput
              value={neighborsSource}
              onChange={(kw) => {
                setNeighborsSource(kw);
                setMaxNeighborDistance(1);
              }}
              label="Center Hexagram"
              placeholder="Search by number or name..."
            />
            {neighborsSourceHex && (
              <NeighborsSidebar
                source={neighborsSourceHex}
                neighbors={neighborsData}
                maxDistance={maxNeighborDistance}
                onDistanceChange={handleDistanceChange}
                onSelectNeighbor={handleSelectNeighbor}
                onClose={() => {
                  setNeighborsSource(null);
                  setNeighborsData(new Map());
                }}
              />
            )}
          </aside>
        )}

        {/* ── Trigram filter mode sidebar ── */}
        {mode === "trigram_filter" && (
          <aside className="w-80 border-l border-border bg-surface p-6 overflow-y-auto animate-fade-in hidden lg:block">
            <TrigramFilterSidebar
              upperFilter={trigramFilter.upper}
              lowerFilter={trigramFilter.lower}
              matchingHexagrams={filteredHexagrams}
              onSetUpper={(bits) => setTrigramFilter((prev) => ({ ...prev, upper: bits }))}
              onSetLower={(bits) => setTrigramFilter((prev) => ({ ...prev, lower: bits }))}
              onClear={() => setTrigramFilter({ upper: null, lower: null })}
              onSelectHexagram={(kw) => {
                // Navigate in explore mode to see full details
                setMode("explore");
                setSelectedHex(kw);
              }}
            />
          </aside>
        )}

        {/* ── Elements mode sidebar ── */}
        {mode === "elements" && (
          <aside className="w-80 border-l border-border bg-surface p-6 overflow-y-auto animate-fade-in hidden lg:block">
            <ElementsSidebar
              selectedElement={selectedElement}
              onSelectElement={(name) => setSelectedElement(name)}
              onSelectHexagram={(kw) => {
                setMode("explore");
                setSelectedHex(kw);
              }}
              onClear={() => setSelectedElement(null)}
            />
          </aside>
        )}

        {/* ── Compass mode sidebar ── */}
        {mode === "compass" && (
          <aside className="w-80 border-l border-border bg-surface p-6 overflow-y-auto animate-fade-in hidden lg:block">
            <CompassSidebar
              arrangement={compassArrangement}
              onSetArrangement={setCompassArrangement}
              selectedTrigram={selectedCompassTrigram}
              onSelectTrigram={(bits) => setSelectedCompassTrigram(bits)}
              onSelectHexagram={(kw) => {
                setMode("explore");
                setSelectedHex(kw);
              }}
              onClear={() => setSelectedCompassTrigram(null)}
            />
          </aside>
        )}
      </div>

      {/* ── Hover Tooltip (Feature 2) — rendered outside the wheel SVG ── */}
      {hoveredHexData && mousePos && (
        <HexagramTooltip
          kingWen={hoveredHexData.king_wen}
          name={hoveredHexData.name}
          title={hoveredHexData.title}
          binary={hoveredHexData.binary}
          upperTrigram={hoveredHexData.upper_trigram}
          lowerTrigram={hoveredHexData.lower_trigram}
          clientX={mousePos.x}
          clientY={mousePos.y}
        />
      )}
    </div>
  );
}
