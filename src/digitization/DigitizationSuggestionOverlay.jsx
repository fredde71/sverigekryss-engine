import React from "react";
import { normalizeDocumentSize } from "../template/documentGeometry";

export default function DigitizationSuggestionOverlay({
  digitizationResult,
  documentSize
}) {
  const grid = getCompletedSuggestionGrid(digitizationResult);

  if (!grid?.bounds) {
    return null;
  }

  const safeDocumentSize = normalizeDocumentSize(documentSize);
  const bounds = grid.bounds;
  const horizontalLines = Array.isArray(grid.horizontalLines)
    ? grid.horizontalLines.filter(Number.isFinite)
    : [];
  const verticalLines = Array.isArray(grid.verticalLines)
    ? grid.verticalLines.filter(Number.isFinite)
    : [];
  const left = finiteOrZero(bounds.left);
  const top = finiteOrZero(bounds.top);
  const width = Math.max(0, finiteOrZero(bounds.width));
  const height = Math.max(0, finiteOrZero(bounds.height));
  const right = left + width;
  const bottom = top + height;

  return (
    <svg
      aria-label="Digitiseringsförhandsvisning"
      data-testid="digitization-suggestion-overlay"
      width={safeDocumentSize.width}
      height={safeDocumentSize.height}
      viewBox={`0 0 ${safeDocumentSize.width} ${safeDocumentSize.height}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${safeDocumentSize.width}px`,
        height: `${safeDocumentSize.height}px`,
        zIndex: 10,
        pointerEvents: "none"
      }}
    >
      <rect
        data-testid="digitization-suggestion-bounds"
        x={left}
        y={top}
        width={width}
        height={height}
        fill="rgba(0, 200, 255, 0.08)"
        stroke="rgba(0, 160, 220, 0.95)"
        strokeWidth="4"
        strokeDasharray="14 8"
      />

      {horizontalLines.map((line, index) => (
        <line
          key={`horizontal-${index}-${line}`}
          data-testid="digitization-suggestion-horizontal-line"
          x1={left}
          y1={line}
          x2={right}
          y2={line}
          stroke="rgba(255, 0, 160, 0.9)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {verticalLines.map((line, index) => (
        <line
          key={`vertical-${index}-${line}`}
          data-testid="digitization-suggestion-vertical-line"
          x1={line}
          y1={top}
          x2={line}
          y2={bottom}
          stroke="rgba(255, 0, 160, 0.9)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

export function getCompletedSuggestionGrid(digitizationResult) {
  if (digitizationResult?.status !== "completed") {
    return null;
  }

  const result = digitizationResult.result || {};
  const suggestion = Array.isArray(result.suggestions)
    ? result.suggestions[0]
    : null;

  return suggestion?.grid || null;
}

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}
