import { fitGridFormatGeometry } from "./GridFormatGeometryFit";

test("fits a generic normalized format independently per axis", () => {
  const input = createInput();
  const before = JSON.stringify(input);
  const result = fitGridFormatGeometry(input);

  expect(result).toMatchObject({
    status: "available",
    formatId: "format-2x3",
    axes: {
      horizontal: { offset: 10, scale: 200 },
      vertical: { offset: 20, scale: 300 }
    }
  });
  expect(result.axes.horizontal.linePositions).toEqual([10, 90, 210]);
  expect(result.axes.vertical.linePositions).toEqual([20, 80, 230, 320]);
  expect(result.axes.horizontal.residuals.map(value => value.residual))
    .toEqual([0, 0, 0]);
  expect(Object.isFrozen(result.axes.horizontal)).toBe(true);
  expect(JSON.stringify(input)).toBe(before);
});

test.each(["ambiguous", "unavailable"])(
  "%s format selection preserves explicit non-available fit status",
  status => {
    const input = createInput();
    input.gridFormatGeometrySelection.status = status;
    input.gridFormatGeometrySelection.selectedFormat = null;
    input.gridFormatGeometrySelection.selectedFormatId = null;

    expect(fitGridFormatGeometry(input)).toMatchObject({ status });
  }
);

test("insufficient accepted anchors leaves fitting unavailable", () => {
  const input = createInput();
  input.acceptedIndexedAnchors.horizontal = [
    input.acceptedIndexedAnchors.horizontal[0]
  ];

  expect(fitGridFormatGeometry(input)).toMatchObject({
    status: "unavailable",
    axes: { horizontal: { status: "unavailable", offset: null, scale: null } }
  });
});

function createInput() {
  return {
    gridFormatGeometrySelection: {
      type: "grid-format-geometry-selection",
      version: 1,
      status: "selected",
      selectedFormatId: "format-2x3",
      selectedFormat: {
        id: "format-2x3",
        axes: {
          horizontal: { normalizedLinePositions: [0, 0.4, 1] },
          vertical: { normalizedLinePositions: [0, 0.2, 0.7, 1] }
        }
      }
    },
    acceptedIndexedAnchors: {
      horizontal: [anchor(0, 10), anchor(1, 90), anchor(2, 210)],
      vertical: [anchor(0, 20), anchor(1, 80), anchor(2, 230), anchor(3, 320)]
    },
    coordinateSystem: { space: "analysis-region-local" }
  };
}

function anchor(latticeIndex, observedPosition) {
  return { latticeIndex, observedPosition, evidenceReferences: [] };
}
