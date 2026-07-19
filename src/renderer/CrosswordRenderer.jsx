import PlayCell from "../components/PlayCell";
import React from "react";

export default function CrosswordRenderer({
  rows,
  cols,
  cellTypes,
  answers,
  activeCell,
  onCellChange,
  onCellClick
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`
      }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => {
        const type = cellTypes[i];

        const isPlayable =
        type === "write" || type === "double";

if (!isPlayable) {
  return <div key={i} />;
}

        return (
  <PlayCell
  key={i}
  value={answers[i] || ""}
  disabled={!isPlayable}
  isActive={activeCell === i}
  onClick={() => onCellClick(i)}
  onChange={(e) => {
    onCellChange(i, e.target.value);
  }}
/>
);
      })}
    </div>
  );
}