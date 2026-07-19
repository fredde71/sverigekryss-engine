import React from "react";

export default function EditorGrid({
  rows,
  cols,
  cellTypes,
  competitionCells = []
}) {
  const competitionPositionsByIndex = new Map(
    competitionCells.map(cell => [cell.index, cell.position])
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",     
        pointerEvents: "none",
        zIndex: 1,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`
      }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            pointerEvents: "none",
            border: "1px solid rgba(0,0,0,0.15)",
            backgroundColor:
              cellTypes[i] === "image"
                ? "rgba(0,120,255,0.3)"
                : cellTypes[i] === "blocked"
                ? "rgba(0,0,0,0.4)"
                : cellTypes[i] === "double"
                ? "rgba(255,0,0,0.3)"
                : cellTypes[i] === "write"
                ? "rgba(0,255,0,0.25)"
                : "rgba(0,0,0,0.0)"
          }}
        >
          {cellTypes[i] === "write" && competitionPositionsByIndex.has(i) && (
            <span
              data-testid={`editor-competition-badge-${i}`}
              style={{
                position: "absolute",
                top: "2px",
                right: "2px",
                minWidth: "16px",
                height: "16px",
                borderRadius: "8px",
                background: "rgb(255, 215, 0)",
                color: "#111",
                fontSize: "11px",
                fontWeight: "bold",
                lineHeight: "16px",
                textAlign: "center"
              }}
            >
              {competitionPositionsByIndex.get(i)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
