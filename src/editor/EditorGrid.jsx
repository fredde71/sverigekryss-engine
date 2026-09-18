import React from "react";
import { CELL_TYPE_BLACK } from "../template/cellTypes";

const GRID_LINE_COLOR = "rgba(0,0,0,0.15)";

export default function EditorGrid({
  rows,
  cols,
  cellTypes,
  competitionCells = [],
  gridArea = null,
  gridLineProposal = null,
  answerPathSelection = null
}) {
  const competitionPositionsByIndex = new Map(
    competitionCells.map(cell => [cell.index, cell.position])
  );
  const explicitGeometry = createExplicitGeometry({
    rows,
    cols,
    gridArea,
    gridLineProposal
  });

  if (explicitGeometry) {
    return (
      <div
        data-testid="editor-grid-explicit"
        style={gridContainerStyle}
      >
        {Array.from({ length: rows * cols }).map((_, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          return (
            <div
              key={index}
              data-testid={`editor-grid-cell-${index}`}
              style={{
                ...createCellStyle(cellTypes[index], false),
                ...createAnswerPathStyle(index, answerPathSelection),
                position: "absolute",
                top: explicitGeometry.horizontal[row],
                left: explicitGeometry.vertical[col],
                width: explicitGeometry.vertical[col + 1]
                  - explicitGeometry.vertical[col],
                height: explicitGeometry.horizontal[row + 1]
                  - explicitGeometry.horizontal[row]
              }}
            >
              {renderCompetitionBadge(index, cellTypes, competitionPositionsByIndex)}
              {renderAnswerPathBadge(index, answerPathSelection)}
            </div>
          );
        })}
        {explicitGeometry.horizontal.map((position, index) => (
          <div
            key={`horizontal-${index}`}
            data-testid={`editor-grid-line-horizontal-${index}`}
            data-line-position={position}
            aria-hidden="true"
            style={{
              position: "absolute",
              zIndex: 1,
              top: position,
              left: explicitGeometry.vertical[0],
              width: explicitGeometry.vertical[cols]
                - explicitGeometry.vertical[0],
              height: "1px",
              background: GRID_LINE_COLOR,
              transform: "translateY(-0.5px)"
            }}
          />
        ))}
        {explicitGeometry.vertical.map((position, index) => (
          <div
            key={`vertical-${index}`}
            data-testid={`editor-grid-line-vertical-${index}`}
            data-line-position={position}
            aria-hidden="true"
            style={{
              position: "absolute",
              zIndex: 1,
              top: explicitGeometry.horizontal[0],
              left: position,
              width: "1px",
              height: explicitGeometry.horizontal[rows]
                - explicitGeometry.horizontal[0],
              background: GRID_LINE_COLOR,
              transform: "translateX(-0.5px)"
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid="editor-grid-uniform"
      style={{
        ...gridContainerStyle,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`
      }}
    >
      {Array.from({ length: rows * cols }).map((_, index) => (
        <div
          key={index}
          data-testid={`editor-grid-cell-${index}`}
          style={{
            ...createCellStyle(cellTypes[index], true),
            ...createAnswerPathStyle(index, answerPathSelection)
          }}
        >
          {renderCompetitionBadge(index, cellTypes, competitionPositionsByIndex)}
          {renderAnswerPathBadge(index, answerPathSelection)}
        </div>
      ))}
    </div>
  );
}

function createExplicitGeometry({
  rows,
  cols,
  gridArea,
  gridLineProposal
}) {
  const horizontal = gridLineProposal?.horizontalLinePositions;
  const vertical = gridLineProposal?.verticalLinePositions;
  const reference = gridLineProposal?.referenceGridArea;

  if (
    !hasValidPositions(horizontal, rows + 1)
    || !hasValidPositions(vertical, cols + 1)
    || !hasValidArea(reference)
    || !hasValidArea(gridArea)
  ) {
    return null;
  }

  return {
    horizontal: projectPositions(
      horizontal,
      reference.top,
      reference.height,
      gridArea.height
    ),
    vertical: projectPositions(
      vertical,
      reference.left,
      reference.width,
      gridArea.width
    )
  };
}

function projectPositions(positions, referenceStart, referenceSize, size) {
  const scale = size / referenceSize;
  return positions.map(position => (position - referenceStart) * scale);
}

function hasValidPositions(positions, expectedCount) {
  return Array.isArray(positions)
    && positions.length === expectedCount
    && positions.every((position, index) => (
      Number.isFinite(position)
      && (index === 0 || position > positions[index - 1])
    ));
}

function hasValidArea(area) {
  return area
    && Number.isFinite(area.top)
    && Number.isFinite(area.left)
    && Number.isFinite(area.width)
    && Number.isFinite(area.height)
    && area.width > 0
    && area.height > 0;
}

function createCellStyle(cellType, includeBorder) {
  return {
    position: "relative",
    pointerEvents: "none",
    ...(includeBorder ? { border: `1px solid ${GRID_LINE_COLOR}` } : {}),
    backgroundColor:
      cellType === CELL_TYPE_BLACK
        ? "rgb(0, 0, 0)"
        : cellType === "image"
          ? "rgba(0,120,255,0.3)"
          : cellType === "blocked"
            ? "rgba(0,0,0,0.4)"
            : cellType === "double"
              ? "rgba(255,0,0,0.3)"
              : cellType === "write"
                ? "rgba(0,255,0,0.25)"
                : "rgba(0,0,0,0.0)"
  };
}

function renderCompetitionBadge(index, cellTypes, positionsByIndex) {
  return cellTypes[index] === "write" && positionsByIndex.has(index) && (
    <span
      data-testid={`editor-competition-badge-${index}`}
      aria-label={`Tävlingsposition ${positionsByIndex.get(index)}`}
      title={`Tävlingsposition ${positionsByIndex.get(index)}`}
      style={{
        position: "absolute",
        top: "2px",
        right: "2px",
        minWidth: "20px",
        height: "20px",
        borderRadius: "10px",
        border: "1px solid rgb(92, 70, 0)",
        background: "rgb(255, 215, 0)",
        color: "#111",
        fontSize: "12px",
        fontWeight: "bold",
        lineHeight: "20px",
        textAlign: "center",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.35)"
      }}
    >
      {positionsByIndex.get(index)}
    </span>
  );
}

function createAnswerPathStyle(index, selection) {
  if (selection?.clueIndex === index) {
    return { boxShadow: "inset 0 0 0 3px rgb(37, 99, 235)" };
  }

  return selection?.cellIndexes?.includes(index)
    ? { backgroundColor: "rgba(147, 51, 234, 0.42)" }
    : {};
}

function renderAnswerPathBadge(index, selection) {
  const position = selection?.cellIndexes?.indexOf(index) ?? -1;
  if (position < 0) return null;

  return (
    <span
      data-testid={`editor-answer-path-position-${position + 1}`}
      style={answerPathBadgeStyle}
    >
      {position + 1}
    </span>
  );
}

const answerPathBadgeStyle = {
  position: "absolute",
  top: "2px",
  left: "2px",
  minWidth: "17px",
  height: "17px",
  borderRadius: "9px",
  background: "rgb(126, 34, 206)",
  color: "#fff",
  fontSize: "11px",
  fontWeight: "bold",
  lineHeight: "17px",
  textAlign: "center"
};

const gridContainerStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  zIndex: 1
};
