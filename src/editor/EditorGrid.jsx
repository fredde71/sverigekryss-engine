import React from "react";

export default function EditorGrid({
  rows,
  cols,
  cellTypes
}) {
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
        />
      ))}
    </div>
  );
}