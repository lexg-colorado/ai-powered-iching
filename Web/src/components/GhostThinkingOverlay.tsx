"use client";

import { useState, useEffect, useRef } from "react";

interface GhostThinkingOverlayProps {
  isVisible: boolean;
  thinkingText: string;
}

export default function GhostThinkingOverlay({
  isVisible,
  thinkingText,
}: GhostThinkingOverlayProps) {
  // Track exit animation so we can keep rendering during fade-out
  const [shouldRender, setShouldRender] = useState(false);
  const [animClass, setAnimClass] = useState("");
  const prevVisible = useRef(false);

  useEffect(() => {
    if (isVisible && !prevVisible.current) {
      // Entering
      setShouldRender(true);
      setAnimClass("ghost-overlay-enter");
    } else if (!isVisible && prevVisible.current) {
      // Exiting — play fade-out, then unmount
      setAnimClass("ghost-overlay-exit");
    }
    prevVisible.current = isVisible;
  }, [isVisible]);

  function handleAnimationEnd() {
    if (!isVisible) {
      setShouldRender(false);
      setAnimClass("");
    }
  }

  if (!shouldRender || !thinkingText) return null;

  return (
    <div
      className={`ghost-overlay ${animClass}`}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="max-w-3xl mx-auto px-4 pt-4 h-full flex flex-col">
        <div className="flex items-center gap-2 text-sm mb-2 shrink-0" style={{ color: "var(--muted)", opacity: 0.4 }}>
          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--accent-yang)", opacity: 0.5 }} />
          <span className="italic font-heading">The oracle is contemplating...</span>
        </div>
        <div
          className="font-mono text-xs leading-relaxed overflow-hidden flex-1"
          style={{ color: "var(--foreground)", opacity: 0.12 }}
        >
          {thinkingText.slice(-600)}
        </div>
      </div>
    </div>
  );
}
