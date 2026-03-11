"use client";

import { useState, useCallback, useRef } from "react";
import type { LineValue, TossResult } from "@/lib/types";
import { castSingleLine, buildTossResult, CASTING_TIMING } from "@/lib/casting";

export type CastingPhase = "idle" | "ready" | "tossing" | "landed" | "complete";

export function useCoinCasting() {
  const [phase, setPhase] = useState<CastingPhase>("idle");
  const [currentLine, setCurrentLine] = useState(1);
  const [tosses, setTosses] = useState<TossResult[]>([]);
  const [lineValues, setLineValues] = useState<(LineValue | null)[]>([
    null, null, null, null, null, null,
  ]);
  const [isAutoCasting, setIsAutoCasting] = useState(false);
  const [currentCoins, setCurrentCoins] = useState<("H" | "T")[] | null>(null);
  const [currentTotal, setCurrentTotal] = useState<LineValue | null>(null);

  // Refs mirror state for use inside timeouts (avoids stale closures)
  const phaseRef = useRef<CastingPhase>("idle");
  const currentLineRef = useRef(1);
  const autoRef = useRef(false);

  // Helpers that keep refs in sync with state
  const updatePhase = useCallback((p: CastingPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const updateCurrentLine = useCallback((n: number) => {
    currentLineRef.current = n;
    setCurrentLine(n);
  }, []);

  const startCasting = useCallback(() => {
    updatePhase("ready");
    updateCurrentLine(1);
    setTosses([]);
    setLineValues([null, null, null, null, null, null]);
    setIsAutoCasting(false);
    setCurrentCoins(null);
    setCurrentTotal(null);
    autoRef.current = false;
  }, [updatePhase, updateCurrentLine]);

  const toss = useCallback(() => {
    if (phaseRef.current !== "ready") return;

    const { coins, total } = castSingleLine();
    const line = currentLineRef.current; // snapshot from ref

    setCurrentCoins(coins);
    setCurrentTotal(total);
    updatePhase("tossing");

    const duration = autoRef.current
      ? CASTING_TIMING.autoCastTossDuration
      : CASTING_TIMING.totalTossDuration;

    setTimeout(() => {
      const result = buildTossResult(line, coins, total);
      setTosses((prev) => [...prev, result]);
      setLineValues((prev) => {
        const next = [...prev];
        next[line - 1] = total;
        return next;
      });
      updatePhase("landed");

      // If auto-casting, advance automatically
      if (autoRef.current) {
        setTimeout(() => {
          if (currentLineRef.current < 6) {
            const nextLine = currentLineRef.current + 1;
            updateCurrentLine(nextLine);
            updatePhase("ready");
          } else {
            updatePhase("complete");
            setIsAutoCasting(false);
            autoRef.current = false;
          }
        }, CASTING_TIMING.autoCastPauseBetween);
      }
    }, duration);
  }, [updatePhase, updateCurrentLine]);

  const advance = useCallback(() => {
    if (phaseRef.current !== "landed") return;

    if (currentLineRef.current < 6) {
      const nextLine = currentLineRef.current + 1;
      updateCurrentLine(nextLine);
      updatePhase("ready");
      setCurrentCoins(null);
      setCurrentTotal(null);
    } else {
      updatePhase("complete");
    }
  }, [updatePhase, updateCurrentLine]);

  const autoCastAll = useCallback(() => {
    if (phaseRef.current !== "ready" && phaseRef.current !== "idle") return;
    autoRef.current = true;
    setIsAutoCasting(true);

    if (phaseRef.current === "idle") {
      updatePhase("ready");
      updateCurrentLine(1);
      setTosses([]);
      setLineValues([null, null, null, null, null, null]);
    }
  }, [updatePhase, updateCurrentLine]);

  const reset = useCallback(() => {
    updatePhase("idle");
    updateCurrentLine(1);
    setTosses([]);
    setLineValues([null, null, null, null, null, null]);
    setIsAutoCasting(false);
    setCurrentCoins(null);
    setCurrentTotal(null);
    autoRef.current = false;
  }, [updatePhase, updateCurrentLine]);

  return {
    phase,
    currentLine,
    tosses,
    lineValues,
    isAutoCasting,
    currentCoins,
    currentTotal,
    startCasting,
    toss,
    advance,
    autoCastAll,
    reset,
    isComplete: phase === "complete",
    currentToss: tosses.length > 0 ? tosses[tosses.length - 1] : null,
  };
}
