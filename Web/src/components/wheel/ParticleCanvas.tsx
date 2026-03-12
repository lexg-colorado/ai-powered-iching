/**
 * Canvas overlay for particle effects on the hexagram wheel.
 *
 * Positioned absolutely over the SVG with pointer-events: none
 * so clicks pass through to the SVG elements beneath.
 */

"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { useParticleSystem } from "../../hooks/useParticleSystem";

export interface ParticleCanvasHandle {
  spawnBurst: (x: number, y: number, color?: string) => void;
  spawnFlow: (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color?: string,
  ) => void;
}

interface ParticleCanvasProps {
  width: number;
  height: number;
}

export const ParticleCanvas = forwardRef<ParticleCanvasHandle, ParticleCanvasProps>(
  function ParticleCanvas({ width, height }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { start, stop, spawnBurst, spawnFlow } = useParticleSystem(canvasRef);

    // Resize canvas to match container
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Use devicePixelRatio for sharp rendering on HiDPI displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    }, [width, height]);

    // Start particle system on mount
    useEffect(() => {
      start();
      return () => stop();
    }, [start, stop]);

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      spawnBurst,
      spawnFlow,
    }));

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ pointerEvents: "none" }}
        aria-hidden="true"
      />
    );
  },
);
