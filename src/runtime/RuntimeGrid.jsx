import React from "react";

export default function RuntimeGrid({
  rows,
  cols,
  children,
  style
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        ...style
      }}
    >
      {children}
    </div>
  );
}