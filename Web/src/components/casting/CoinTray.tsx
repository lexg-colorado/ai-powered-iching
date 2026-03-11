"use client";

import Coin from "./Coin";
import { LINE_INFO } from "@/lib/hexagram";
import type { LineValue } from "@/lib/types";

interface CoinTrayProps {
  coins: ("H" | "T")[] | null;
  total: LineValue | null;
  spinning: boolean;
  revealed: boolean;
}

export default function CoinTray({
  coins,
  total,
  spinning,
  revealed,
}: CoinTrayProps) {
  const faces = coins || [null, null, null];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-4 sm:gap-6">
        {faces.map((face, i) => (
          <Coin
            key={i}
            face={face}
            revealed={revealed}
            spinning={spinning}
            index={i}
          />
        ))}
      </div>

      {revealed && total !== null && coins && (
        <div className="text-center animate-fade-in">
          <p className="text-sm text-muted">
            {coins.filter((c) => c === "H").length} heads +{" "}
            {coins.filter((c) => c === "T").length} tails ={" "}
            <span className="font-bold text-foreground">
              {total}
            </span>
          </p>
          <p className="text-sm font-medium mt-1">
            <span
              className={
                LINE_INFO[total].isChanging
                  ? "text-changing"
                  : "text-foreground"
              }
            >
              {LINE_INFO[total].name}
              {LINE_INFO[total].isChanging && " (changing)"}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
