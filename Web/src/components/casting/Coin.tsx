"use client";

interface CoinProps {
  face: "H" | "T" | null;
  revealed: boolean;
  spinning: boolean;
  index: number;
}

export default function Coin({ face, revealed, spinning, index }: CoinProps) {
  const stagger = index * 100;

  return (
    <div
      className="relative w-14 h-14 sm:w-16 sm:h-16"
      style={{ animationDelay: `${stagger}ms` }}
    >
      <div
        className={`w-full h-full rounded-full border-2 transition-all duration-300 flex items-center justify-center text-lg font-bold
          ${spinning ? "coin-spin" : ""}
          ${
            revealed && face === "H"
              ? "border-yang bg-yang/10 text-yang shadow-[0_0_14px_rgba(184,134,11,0.35)]"
              : revealed && face === "T"
                ? "border-yin bg-yin/10 text-yin shadow-[0_0_14px_rgba(74,102,112,0.3)]"
                : "border-border bg-surface text-muted"
          }
        `}
      >
        {revealed && face ? (
          <span className="coin-settle">{face === "H" ? "3" : "2"}</span>
        ) : spinning ? (
          <span className="opacity-30">?</span>
        ) : (
          <span className="opacity-20">-</span>
        )}
      </div>
      {revealed && face && (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted">
          {face === "H" ? "Heads" : "Tails"}
        </span>
      )}
    </div>
  );
}
