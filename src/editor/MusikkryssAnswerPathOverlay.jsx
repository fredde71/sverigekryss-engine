import React from "react";

export default function MusikkryssAnswerPathOverlay({
  template,
  cellIndexes = []
}) {
  const geometry = getExplicitCellGeometry(template);
  if (!geometry) return null;

  const positions = new Map(cellIndexes.map((index, order) => [index, order + 1]));

  return (
    <div
      data-testid="musikkryss-answer-path-overlay"
      data-path-mode="derived"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        pointerEvents: "none"
      }}
    >
      {Array.from({ length: template.rows * template.cols }, (_, index) => {
        const row = Math.floor(index / template.cols);
        const col = index % template.cols;
        const writable = template.cellTypes[index] === "write";
        const order = positions.get(index);

        if (!writable || !order) return null;

        return (
          <button
            key={index}
            type="button"
            data-testid={`musikkryss-path-cell-${index}`}
            aria-label={`Härledd svarscell ${index + 1}`}
            disabled
            style={{
              position: "absolute",
              top: geometry.horizontal[row],
              left: geometry.vertical[col],
              width: geometry.vertical[col + 1] - geometry.vertical[col],
              height: geometry.horizontal[row + 1] - geometry.horizontal[row],
              padding: 0,
              boxSizing: "border-box",
              border: order ? "2px solid rgb(30, 64, 175)" : "none",
              background: order
                ? "rgba(59, 130, 246, 0.28)"
                : "transparent",
              color: "#fff",
              fontWeight: 700,
              cursor: "default",
              pointerEvents: "none"
            }}
          >
            {order || ""}
          </button>
        );
      })}
    </div>
  );
}

function getExplicitCellGeometry(template) {
  const horizontal = template.horizontalLinePositions;
  const vertical = template.verticalLinePositions;

  if (
    !hasPositions(horizontal, template.rows + 1)
    || !hasPositions(vertical, template.cols + 1)
  ) {
    return null;
  }

  return { horizontal, vertical };
}

function hasPositions(value, count) {
  return Array.isArray(value)
    && value.length === count
    && value.every((position, index) => (
      Number.isFinite(position)
      && (index === 0 || position > value[index - 1])
    ));
}
