import React from "react";

export default function RuntimeGrid({
  rows,
  cols,
  gridArea,
  horizontalLinePositions,
  verticalLinePositions,
  children,
  style
}) {
  const explicitGeometry = createExplicitGeometry({
    rows,
    cols,
    gridArea,
    horizontalLinePositions,
    verticalLinePositions
  });

  if (explicitGeometry) {
    return (
      <div
        data-testid="runtime-grid-explicit"
        style={gridStyle(style)}
      >
        {React.Children.toArray(children).map((child, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;

          return React.cloneElement(child, {
            style: {
              ...child.props.style,
              position: "absolute",
              top: explicitGeometry.horizontal[row],
              left: explicitGeometry.vertical[col],
              width: explicitGeometry.vertical[col + 1]
                - explicitGeometry.vertical[col],
              height: explicitGeometry.horizontal[row + 1]
                - explicitGeometry.horizontal[row]
            }
          });
        })}
      </div>
    );
  }

  return (
    <div data-testid="runtime-grid-uniform"
      style={{
        ...gridStyle(style),
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`
      }}
    >
      {children}
    </div>
  );
}

function createExplicitGeometry({
  rows,
  cols,
  gridArea,
  horizontalLinePositions,
  verticalLinePositions
}) {
  if (
    !hasValidArea(gridArea)
    || !hasValidPositions(horizontalLinePositions, rows + 1)
    || !hasValidPositions(verticalLinePositions, cols + 1)
  ) return null;

  return {
    horizontal: horizontalLinePositions.map(position => position - gridArea.top),
    vertical: verticalLinePositions.map(position => position - gridArea.left)
  };
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

function gridStyle(style) {
  return {
    position: "absolute",
    inset: 0,
    ...style
  };
}
