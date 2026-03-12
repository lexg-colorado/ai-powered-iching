import { useState, useCallback } from "react";

const TRIGRAM_NAMES = {
  "111": "☰ Qián (Heaven)",
  "110": "☴ Xùn (Wind)",
  "101": "☲ Lí (Fire)",
  "100": "☶ Gèn (Mountain)",
  "011": "☱ Duì (Lake)",
  "010": "☵ Kǎn (Water)",
  "001": "☳ Zhèn (Thunder)",
  "000": "☷ Kūn (Earth)",
};

const TRIGRAM_SYMBOLS = {
  "111": "☰", "110": "☴", "101": "☲", "100": "☶",
  "011": "☱", "010": "☵", "001": "☳", "000": "☷",
};

function Line({ value, position, highlighted, windowLabel, dimmed }) {
  const y = 10;
  const lineWidth = 120;
  const gap = 14;
  const strokeWidth = 7;

  const baseColor = value === 1 ? "#e8dcc8" : "#e8dcc8";
  let color = baseColor;
  if (highlighted === "lower") color = "#f59e42";
  else if (highlighted === "upper") color = "#42a5f5";
  else if (highlighted === "overlap") {
    color = "#a855f7";
  }

  const opacity = dimmed ? 0.2 : 1;

  return (
    <g style={{ opacity, transition: "opacity 0.4s ease" }}>
      {value === 1 ? (
        <line x1={0} y1={y} x2={lineWidth} y2={y} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      ) : (
        <>
          <line x1={0} y1={y} x2={lineWidth / 2 - gap} y2={y} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1={lineWidth / 2 + gap} y1={y} x2={lineWidth} y2={y} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        </>
      )}
      <text x={-30} y={y + 5} fill="#706858" fontSize="11" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ opacity: dimmed ? 0.3 : 0.6 }}>
        {position}
      </text>
      <text x={lineWidth + 14} y={y + 5} fill={dimmed ? "#504838" : "#b0a890"} fontSize="13" fontFamily="'JetBrains Mono', monospace" textAnchor="start" fontWeight="600">
        {value}
      </text>
      {windowLabel && (
        <text x={lineWidth + 38} y={y + 5} fill={windowLabel.color} fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="start" fontWeight="500">
          {windowLabel.text}
        </text>
      )}
    </g>
  );
}

function Hexagram({ bits, showNuclear, label, subtitle }) {
  const lineSpacing = 28;
  const lines = [...bits].reverse();

  const getHighlight = (originalPos) => {
    if (!showNuclear) return null;
    const inLower = originalPos >= 2 && originalPos <= 4;
    const inUpper = originalPos >= 3 && originalPos <= 5;
    if (inLower && inUpper) return "overlap";
    if (inLower) return "lower";
    if (inUpper) return "upper";
    return null;
  };

  const isDimmed = (originalPos) => {
    if (!showNuclear) return false;
    return originalPos === 1 || originalPos === 6;
  };

  const getWindowLabel = (originalPos) => {
    if (!showNuclear) return null;
    if (originalPos === 2) return { text: "← lower nuclear", color: "#f59e42" };
    if (originalPos === 5) return { text: "← upper nuclear", color: "#42a5f5" };
    if (originalPos === 3) return { text: "← overlap", color: "#a855f7" };
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {label && <div style={{ color: "#e8dcc8", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "6px", opacity: 0.6 }}>{label}</div>}
      {subtitle && <div style={{ color: "#b0a890", fontSize: "14px", fontFamily: "'Crimson Pro', Georgia, serif", marginBottom: "14px", fontStyle: "italic" }}>{subtitle}</div>}
      <svg width={220} height={lines.length * lineSpacing + 10} style={{ overflow: "visible" }}>
        {lines.map((val, i) => {
          const originalPos = 6 - i;
          return (
            <g key={i} transform={`translate(40, ${i * lineSpacing})`}>
              <Line
                value={val}
                position={originalPos}
                highlighted={getHighlight(originalPos)}
                dimmed={isDimmed(originalPos)}
                windowLabel={getWindowLabel(originalPos)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MiniHexagram({ bits, highlight }) {
  const lines = [...bits].reverse();
  const lineSpacing = 12;
  const lineWidth = 44;
  const gap = 5;
  const sw = 3.5;

  const color = highlight === "lower" ? "#f59e42" : highlight === "upper" ? "#42a5f5" : "#e8dcc8";

  return (
    <svg width={lineWidth + 4} height={lines.length * lineSpacing + 6} style={{ overflow: "visible" }}>
      {lines.map((val, i) => (
        <g key={i} transform={`translate(2, ${i * lineSpacing + 4})`}>
          {val === 1 ? (
            <line x1={0} y1={0} x2={lineWidth} y2={0} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          ) : (
            <>
              <line x1={0} y1={0} x2={lineWidth / 2 - gap} y2={0} stroke={color} strokeWidth={sw} strokeLinecap="round" />
              <line x1={lineWidth / 2 + gap} y1={0} x2={lineWidth} y2={0} stroke={color} strokeWidth={sw} strokeLinecap="round" />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

function BitToggle({ bits, onToggle }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      {bits.map((b, i) => (
        <button
          key={i}
          onClick={() => onToggle(i)}
          style={{
            width: "38px",
            height: "38px",
            border: "1px solid rgba(232, 220, 200, 0.2)",
            borderRadius: "4px",
            background: b === 1 ? "rgba(232, 220, 200, 0.15)" : "transparent",
            color: "#e8dcc8",
            fontSize: "16px",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={e => { e.target.style.background = "rgba(232, 220, 200, 0.25)"; }}
          onMouseLeave={e => { e.target.style.background = b === 1 ? "rgba(232, 220, 200, 0.15)" : "transparent"; }}
        >
          {b}
        </button>
      ))}
      <span style={{ color: "#706858", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", marginLeft: "6px" }}>
        ← click to flip
      </span>
    </div>
  );
}

function WindowDiagram({ bits }) {
  const cellSize = 38;
  const padding = 2;

  return (
    <svg width={bits.length * (cellSize + padding) + 120} height={160} style={{ overflow: "visible" }}>
      <text x={0} y={16} fill="#706858" fontSize="10" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.1em">BIT POSITION</text>
      {bits.map((b, i) => (
        <g key={i} transform={`translate(${i * (cellSize + padding)}, 24)`}>
          <rect width={cellSize} height={cellSize} rx={3} fill="rgba(232,220,200,0.06)" stroke="rgba(232,220,200,0.15)" strokeWidth={1} />
          <text x={cellSize / 2} y={cellSize / 2 + 1} fill="#e8dcc8" fontSize="16" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" dominantBaseline="middle" fontWeight="700">{b}</text>
          <text x={cellSize / 2} y={-6} fill="#706858" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{i + 1}</text>
        </g>
      ))}

      {/* Lower nuclear window: positions 2-3-4 (indices 1,2,3) */}
      <g transform={`translate(${1 * (cellSize + padding) - 3}, ${24 + cellSize + 10})`}>
        <rect width={3 * cellSize + 2 * padding + 6} height={28} rx={4} fill="rgba(245,158,66,0.1)" stroke="#f59e42" strokeWidth={1.5} strokeDasharray="4 2" />
        <text x={8} y={18} fill="#f59e42" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
          lower nuclear [2-3-4]
        </text>
      </g>

      {/* Upper nuclear window: positions 3-4-5 (indices 2,3,4) */}
      <g transform={`translate(${2 * (cellSize + padding) - 3}, ${24 + cellSize + 44})`}>
        <rect width={3 * cellSize + 2 * padding + 6} height={28} rx={4} fill="rgba(66,165,245,0.1)" stroke="#42a5f5" strokeWidth={1.5} strokeDasharray="4 2" />
        <text x={8} y={18} fill="#42a5f5" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
          upper nuclear [3-4-5]
        </text>
      </g>

      {/* Overlap indicator */}
      <g transform={`translate(${2 * (cellSize + padding)}, 24)`}>
        <rect width={2 * (cellSize + padding)} height={cellSize} rx={3} fill="none" stroke="#a855f7" strokeWidth={2} strokeDasharray="3 2" opacity={0.6} />
      </g>
      <text x={2 * (cellSize + padding) + cellSize + padding} y={24 + cellSize + 90} fill="#a855f7" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" opacity={0.7}>
        overlap at 3-4
      </text>
    </svg>
  );
}

export default function IChing() {
  const [bits, setBits] = useState([1, 0, 1, 1, 0, 1]);
  const [showNuclear, setShowNuclear] = useState(true);

  const toggleBit = useCallback((i) => {
    setBits(prev => {
      const next = [...prev];
      next[i] = next[i] === 1 ? 0 : 1;
      return next;
    });
  }, []);

  const lowerNuclear = bits.slice(1, 4);
  const upperNuclear = bits.slice(2, 5);
  const outerLower = bits.slice(0, 3);
  const outerUpper = bits.slice(3, 6);
  const nuclearBits = [...lowerNuclear, ...upperNuclear];

  const lowerKey = [...lowerNuclear].reverse().join("");
  const upperKey = [...upperNuclear].reverse().join("");
  const outerLowerKey = [...outerLower].reverse().join("");
  const outerUpperKey = [...outerUpper].reverse().join("");

  const hexNumber = parseInt(bits.join(""), 2);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1a1610",
      color: "#e8dcc8",
      fontFamily: "'Crimson Pro', Georgia, serif",
      padding: "40px 24px",
      display: "flex",
      justifyContent: "center",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: "720px", width: "100%" }}>
        {/* Title */}
        <div style={{ marginBottom: "48px" }}>
          <h1 style={{
            fontSize: "28px",
            fontWeight: 300,
            letterSpacing: "0.04em",
            margin: 0,
            color: "#e8dcc8",
          }}>
            Nuclear Hexagrams
          </h1>
          <div style={{
            fontSize: "13px",
            color: "#706858",
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: "8px",
            letterSpacing: "0.08em",
          }}>
            SLIDING WINDOW EXTRACTION FROM 6-BIT WORDS
          </div>
          <div style={{
            width: "40px",
            height: "1px",
            background: "rgba(232,220,200,0.2)",
            marginTop: "20px",
          }} />
        </div>

        {/* Input */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ fontSize: "10px", color: "#706858", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "12px" }}>
            6-BIT WORD · HEXAGRAM #{hexNumber}
          </div>
          <BitToggle bits={bits} onToggle={toggleBit} />
        </div>

        {/* Window diagram */}
        <div style={{ marginBottom: "44px" }}>
          <WindowDiagram bits={bits} />
        </div>

        {/* Toggle */}
        <div style={{ marginBottom: "36px" }}>
          <button
            onClick={() => setShowNuclear(!showNuclear)}
            style={{
              background: showNuclear ? "rgba(168, 85, 247, 0.12)" : "transparent",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              color: showNuclear ? "#c4a0f7" : "#706858",
              padding: "8px 16px",
              borderRadius: "4px",
              fontSize: "12px",
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
              letterSpacing: "0.05em",
              transition: "all 0.3s ease",
            }}
          >
            {showNuclear ? "● " : "○ "}SHOW NUCLEAR EXTRACTION
          </button>
        </div>

        {/* Hexagrams side by side */}
        <div style={{
          display: "flex",
          gap: "60px",
          flexWrap: "wrap",
          marginBottom: "48px",
        }}>
          <div>
            <Hexagram bits={bits} showNuclear={showNuclear} label="Parent Hexagram" subtitle={`${TRIGRAM_SYMBOLS[outerUpperKey]} over ${TRIGRAM_SYMBOLS[outerLowerKey]}`} />
            <div style={{ marginTop: "12px", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#706858" }}>
              <div>upper: {TRIGRAM_NAMES[outerUpperKey]}</div>
              <div>lower: {TRIGRAM_NAMES[outerLowerKey]}</div>
            </div>
          </div>

          {showNuclear && (
            <div style={{ animation: "fadeIn 0.5s ease" }}>
              <Hexagram bits={nuclearBits} showNuclear={false} label="Nuclear Hexagram" subtitle={`${TRIGRAM_SYMBOLS[upperKey]} over ${TRIGRAM_SYMBOLS[lowerKey]}`} />
              <div style={{ marginTop: "12px", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace" }}>
                <div style={{ color: "#42a5f5" }}>upper: {TRIGRAM_NAMES[upperKey]}</div>
                <div style={{ color: "#f59e42" }}>lower: {TRIGRAM_NAMES[lowerKey]}</div>
              </div>
            </div>
          )}
        </div>

        {/* Extraction detail */}
        {showNuclear && (
          <div style={{
            background: "rgba(232,220,200,0.03)",
            border: "1px solid rgba(232,220,200,0.08)",
            borderRadius: "6px",
            padding: "24px",
            marginBottom: "48px",
            animation: "fadeIn 0.5s ease",
          }}>
            <div style={{ fontSize: "10px", color: "#706858", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em", marginBottom: "16px" }}>
              EXTRACTION DETAIL
            </div>

            <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#f59e42", marginBottom: "8px" }}>
                  Lower Window [2,3,4] → [{lowerNuclear.join(",")}]
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <MiniHexagram bits={[...lowerNuclear, 0, 0, 0]} highlight="lower" />
                  <span style={{ color: "#706858", fontSize: "13px" }}>{TRIGRAM_NAMES[lowerKey]}</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#42a5f5", marginBottom: "8px" }}>
                  Upper Window [3,4,5] → [{upperNuclear.join(",")}]
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <MiniHexagram bits={[0, 0, 0, ...upperNuclear]} highlight="upper" />
                  <span style={{ color: "#706858", fontSize: "13px" }}>{TRIGRAM_NAMES[upperKey]}</span>
                </div>
              </div>
            </div>

            <div style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid rgba(232,220,200,0.06)",
              fontSize: "13px",
              color: "#908870",
              fontStyle: "italic",
              lineHeight: 1.6,
            }}>
              Positions 3 and 4 appear in both windows — this shared dependency means the nuclear trigrams are not independent. The inner structure is entangled.
            </div>
          </div>
        )}

        {/* Conceptual note */}
        <div style={{
          fontSize: "14px",
          lineHeight: 1.8,
          color: "#908870",
          maxWidth: "560px",
        }}>
          <p style={{ margin: "0 0 12px 0" }}>
            The outer trigrams (lines 1–3, 4–6) give the <em>manifest</em> reading. The nuclear trigrams (lines 2–4, 3–5) reveal the <em>latent</em> situation — the hidden dynamic inside the hexagram that drives transformation.
          </p>
          <p style={{ margin: 0 }}>
            Two overlapping 3-bit windows, offset by one position, sharing two interior bits. A dimensionality reduction from 6 bits to a dependent pair of 3-bit structures.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
