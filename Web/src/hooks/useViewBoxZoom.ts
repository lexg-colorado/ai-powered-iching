/**
 * Animated SVG viewBox zoom for focus-on-selection.
 *
 * Computes a bounding box around the selected hexagram and its relationship
 * targets, then smoothly interpolates the viewBox via requestAnimationFrame.
 *
 * Respects prefers-reduced-motion by snapping instantly.
 */

import { useState, useRef, useCallback, useEffect } from "react";

interface ZoomTarget {
  x: number;
  y: number;
}

interface UseViewBoxZoomOptions {
  /** Default full-size viewBox (e.g. "0 0 800 800") */
  defaultViewBox: string;
  /** Animation duration in ms */
  duration?: number;
  /** Padding factor around the bounding box (0.25 = 25% padding) */
  padding?: number;
}

interface ViewBoxState {
  x: number;
  y: number;
  w: number;
  h: number;
}

function parseViewBox(vb: string): ViewBoxState {
  const [x, y, w, h] = vb.split(" ").map(Number);
  return { x, y, w, h };
}

function serializeViewBox(vb: ViewBoxState): string {
  return `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpViewBox(from: ViewBoxState, to: ViewBoxState, t: number): ViewBoxState {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    w: lerp(from.w, to.w, t),
    h: lerp(from.h, to.h, t),
  };
}

/** Ease-out cubic */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useViewBoxZoom({
  defaultViewBox,
  duration = 400,
  padding = 0.35,
}: UseViewBoxZoomOptions) {
  const defaultVB = parseViewBox(defaultViewBox);
  const [viewBox, setViewBox] = useState(defaultViewBox);
  const [isZoomed, setIsZoomed] = useState(false);

  const animRef = useRef<number | null>(null);
  const currentVBRef = useRef<ViewBoxState>(defaultVB);

  // Check prefers-reduced-motion
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const animateTo = useCallback(
    (target: ViewBoxState) => {
      // Cancel any in-progress animation
      if (animRef.current != null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }

      const from = { ...currentVBRef.current };

      if (prefersReducedMotion.current) {
        // Snap instantly
        currentVBRef.current = target;
        setViewBox(serializeViewBox(target));
        return;
      }

      const start = performance.now();

      const tick = (now: number) => {
        const elapsed = now - start;
        const rawT = Math.min(elapsed / duration, 1);
        const t = easeOut(rawT);

        const current = lerpViewBox(from, target, t);
        currentVBRef.current = current;
        setViewBox(serializeViewBox(current));

        if (rawT < 1) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          animRef.current = null;
        }
      };

      animRef.current = requestAnimationFrame(tick);
    },
    [duration],
  );

  /** Zoom to show the given targets with padding */
  const zoomTo = useCallback(
    (targets: ZoomTarget[]) => {
      if (targets.length === 0) {
        reset();
        return;
      }

      // Compute bounding box
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      for (const t of targets) {
        if (t.x < minX) minX = t.x;
        if (t.y < minY) minY = t.y;
        if (t.x > maxX) maxX = t.x;
        if (t.y > maxY) maxY = t.y;
      }

      // Add padding
      const rangeX = maxX - minX || 80;
      const rangeY = maxY - minY || 80;
      const padX = rangeX * padding;
      const padY = rangeY * padding;

      const boxW = rangeX + padX * 2;
      const boxH = rangeY + padY * 2;

      // Make square (keep aspect ratio)
      const side = Math.max(boxW, boxH);
      // Enforce a minimum zoom level so we don't zoom in too tight
      const minSide = defaultVB.w * 0.3;
      const finalSide = Math.max(side, minSide);

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const target: ViewBoxState = {
        x: cx - finalSide / 2,
        y: cy - finalSide / 2,
        w: finalSide,
        h: finalSide,
      };

      setIsZoomed(true);
      animateTo(target);
    },
    [animateTo, padding, defaultVB.w],
  );

  /** Reset to default (full) view */
  const reset = useCallback(() => {
    setIsZoomed(false);
    animateTo(defaultVB);
  }, [animateTo, defaultVB]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animRef.current != null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, []);

  return { viewBox, isZoomed, zoomTo, reset };
}
