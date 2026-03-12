/**
 * Canvas particle system for the hexagram wheel.
 *
 * Manages particle lifecycle: spawn, update, render, cull.
 * Renders on a <canvas> overlay with pointer-events: none.
 */

import { useRef, useCallback, useEffect } from "react";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: "burst" | "flow" | "ambient";
}

interface UseParticleSystemOptions {
  /** Maximum particles alive at once */
  maxParticles?: number;
  /** Enable ambient drift particles */
  ambient?: boolean;
}

export function useParticleSystem(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseParticleSystemOptions = {},
) {
  const { maxParticles = 150, ambient = true } = options;

  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const runningRef = useRef(false);
  const colorsRef = useRef({
    yang: "#b8860b",
    accent: "#8b6914",
    changing: "#c4750c",
    yin: "#4a6670",
    border: "#d9d0c3",
  });

  // Read theme colors from CSS on mount
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    colorsRef.current = {
      yang: style.getPropertyValue("--accent-yang").trim() || "#b8860b",
      accent: style.getPropertyValue("--accent-primary").trim() || "#8b6914",
      changing: style.getPropertyValue("--accent-changing").trim() || "#c4750c",
      yin: style.getPropertyValue("--accent-yin").trim() || "#4a6670",
      border: style.getPropertyValue("--border").trim() || "#d9d0c3",
    };
  }, []);

  // Spawn a burst of particles at a point
  const spawnBurst = useCallback(
    (x: number, y: number, color?: string) => {
      const c = color || colorsRef.current.yang;
      const count = 20;
      const particles = particlesRef.current;

      for (let i = 0; i < count; i++) {
        if (particles.length >= maxParticles) break;

        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 1.5 + Math.random() * 3;

        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.6 + Math.random() * 0.4,
          color: c,
          size: 1.5 + Math.random() * 2,
          type: "burst",
        });
      }
    },
    [maxParticles],
  );

  // Spawn flow particles along a path (from → to via control point)
  const spawnFlow = useCallback(
    (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      color?: string,
    ) => {
      const c = color || colorsRef.current.accent;
      const particles = particlesRef.current;
      const count = 8;

      for (let i = 0; i < count; i++) {
        if (particles.length >= maxParticles) break;

        // Stagger spawn over time via initial position along the line
        const t = i / count;
        const x = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 4;
        const y = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 4;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = 0.8 + Math.random() * 0.5;

        particles.push({
          x,
          y,
          vx: (dx / dist) * speed + (Math.random() - 0.5) * 0.3,
          vy: (dy / dist) * speed + (Math.random() - 0.5) * 0.3,
          life: 1,
          maxLife: 1.0 + Math.random() * 0.5,
          color: c,
          size: 1 + Math.random() * 1.5,
          type: "flow",
        });
      }
    },
    [maxParticles],
  );

  // Main animation loop
  const tick = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    const dt = 1 / 60; // Assume 60fps for simplicity

    // Spawn ambient particles occasionally
    if (ambient && particles.length < 10 && Math.random() < 0.02) {
      const edge = Math.random() * Math.PI * 2;
      const r = Math.min(canvas.width, canvas.height) * 0.42;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      particles.push({
        x: cx + r * Math.cos(edge) + (Math.random() - 0.5) * 20,
        y: cy + r * Math.sin(edge) + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: 1,
        maxLife: 3 + Math.random() * 2,
        color: colorsRef.current.border,
        size: 1 + Math.random(),
        type: "ambient",
      });
    }

    // Update and render
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // Update
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt / p.maxLife;

      // Friction for burst particles
      if (p.type === "burst") {
        p.vx *= 0.96;
        p.vy *= 0.96;
      }

      // Cull dead particles
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      // Render
      const alpha = Math.max(0, p.life) * (p.type === "ambient" ? 0.15 : 0.7);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    if (runningRef.current) {
      animFrameRef.current = requestAnimationFrame(tick);
    }
  }, [canvasRef, ambient]);

  // Start/stop the animation loop
  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return; // Don't start particles
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(animFrameRef.current);
    particlesRef.current = [];

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [canvasRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return { start, stop, spawnBurst, spawnFlow };
}
