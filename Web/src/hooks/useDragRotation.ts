/**
 * Pointer-event based drag-to-rotate with optional momentum.
 *
 * Returns the current rotation angle and pointer event handlers
 * to attach to the wheel container.
 */

import { useRef, useState, useCallback } from "react";

interface UseDragRotationOptions {
  /** Enable momentum on release. Default true. */
  momentum?: boolean;
  /** Friction coefficient for momentum decay. Default 0.95. */
  friction?: number;
}

interface UseDragRotationResult {
  rotation: number;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  resetRotation: () => void;
}

export function useDragRotation(
  centerX: number,
  centerY: number,
  options: UseDragRotationOptions = {},
): UseDragRotationResult {
  const { momentum = true, friction = 0.95 } = options;

  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef({
    active: false,
    startAngle: 0,
    startRotation: 0,
    lastAngle: 0,
    velocity: 0,
    animFrame: 0,
  });

  const getAngle = useCallback(
    (e: React.PointerEvent) => {
      // Get SVG-relative coordinates from the pointer event
      const rect = (e.currentTarget as Element).getBoundingClientRect();
      const x = e.clientX - rect.left - centerX * (rect.width / (centerX * 2));
      const y = e.clientY - rect.top - centerY * (rect.height / (centerY * 2));
      return Math.atan2(y, x) * (180 / Math.PI);
    },
    [centerX, centerY],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only drag on background clicks (not on hexagram glyphs)
      const target = e.target as Element;
      if (target.closest("[role='button']")) return;

      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);

      // Cancel any ongoing momentum animation
      cancelAnimationFrame(dragRef.current.animFrame);

      const angle = getAngle(e);
      dragRef.current = {
        ...dragRef.current,
        active: true,
        startAngle: angle,
        startRotation: rotation,
        lastAngle: angle,
        velocity: 0,
      };
      setIsDragging(true);
    },
    [getAngle, rotation],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.active) return;

      const angle = getAngle(e);
      const delta = angle - dragRef.current.startAngle;
      const newRotation = dragRef.current.startRotation + delta;

      // Track velocity for momentum
      dragRef.current.velocity = angle - dragRef.current.lastAngle;
      dragRef.current.lastAngle = angle;

      setRotation(newRotation);
    },
    [getAngle],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.active) return;

      dragRef.current.active = false;
      setIsDragging(false);

      // Apply momentum
      if (momentum && Math.abs(dragRef.current.velocity) > 0.5) {
        let vel = dragRef.current.velocity;
        let rot = rotation;

        const animate = () => {
          vel *= friction;
          rot += vel;

          if (Math.abs(vel) < 0.1) {
            setRotation(rot);
            return;
          }

          setRotation(rot);
          dragRef.current.animFrame = requestAnimationFrame(animate);
        };

        dragRef.current.animFrame = requestAnimationFrame(animate);
      }
    },
    [momentum, friction, rotation],
  );

  const resetRotation = useCallback(() => {
    cancelAnimationFrame(dragRef.current.animFrame);
    setRotation(0);
  }, []);

  return {
    rotation,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    resetRotation,
  };
}
