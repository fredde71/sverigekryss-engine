import { createGridFormatGeometry } from "./GridFormatGeometry";
import {
  createGridFormatGeometryCatalog,
  GRID_FORMAT_GEOMETRY_CATALOG
} from "./GridFormatGeometryCatalog";

test("creates deterministic immutable normalized geometry", () => {
  const input = createGeometryInput();
  const first = createGridFormatGeometry(input);
  const second = createGridFormatGeometry(input);

  expect(first).toEqual(second);
  expect(first).toEqual({
    type: "grid-format-geometry",
    version: 1,
    id: "format-2x3",
    coordinateSpace: "normalized-grid-format",
    gridDimensions: { rows: 2, cols: 3 },
    axes: {
      horizontal: { normalizedLinePositions: [0, 0.45, 1] },
      vertical: { normalizedLinePositions: [0, 0.3, 0.65, 1] }
    },
    provenance: { source: "test" }
  });
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axes.horizontal.normalizedLinePositions)).toBe(true);

  input.axes.horizontal.normalizedLinePositions[1] = 0.5;
  expect(first.axes.horizontal.normalizedLinePositions[1]).toBe(0.45);
});

test.each([
  ["invalid rows", input => { input.gridDimensions.rows = 0; }, "gridDimensions.rows"],
  ["wrong line count", input => { input.axes.horizontal.normalizedLinePositions.pop(); }, "must contain 3"],
  ["nonzero start", input => { input.axes.vertical.normalizedLinePositions[0] = 0.1; }, "start at 0"],
  ["non-unit end", input => { input.axes.vertical.normalizedLinePositions[3] = 0.9; }, "end at 1"],
  ["duplicate positions", input => { input.axes.vertical.normalizedLinePositions[2] = 0.3; }, "strictly increasing"],
  ["non-finite positions", input => { input.axes.horizontal.normalizedLinePositions[1] = Infinity; }, "finite numbers"]
])("rejects %s", (_name, mutate, message) => {
  const input = createGeometryInput();
  mutate(input);
  expect(() => createGridFormatGeometry(input)).toThrow(message);
});

test("catalog preserves format order and rejects duplicate ids", () => {
  const first = createGeometryInput();
  const second = {
    ...createGeometryInput(),
    id: "format-2x3-alternative"
  };
  const catalog = createGridFormatGeometryCatalog({
    id: "test-catalog",
    formats: [first, second]
  });

  expect(catalog.formats.map(format => format.id)).toEqual([
    "format-2x3",
    "format-2x3-alternative"
  ]);
  expect(Object.isFrozen(catalog.formats)).toBe(true);
  expect(() => createGridFormatGeometryCatalog({
    id: "duplicate-catalog",
    formats: [first, first]
  })).toThrow("duplicate id format-2x3");
});

test("production catalog contains complete generic normalized 25x25 geometry", () => {
  const [format] = GRID_FORMAT_GEOMETRY_CATALOG.formats;

  expect(format.id).toBe("grid-format-25x25-v1");
  expect(format.gridDimensions).toEqual({ rows: 25, cols: 25 });
  expect(format.axes.horizontal.normalizedLinePositions).toHaveLength(26);
  expect(format.axes.vertical.normalizedLinePositions).toHaveLength(26);
  expect(format.axes.horizontal.normalizedLinePositions[0]).toBe(0);
  expect(format.axes.horizontal.normalizedLinePositions[25]).toBe(1);
  expect(format.axes.vertical.normalizedLinePositions[0]).toBe(0);
  expect(format.axes.vertical.normalizedLinePositions[25]).toBe(1);
  expect(JSON.stringify(format)).not.toMatch(/filename|dataset|ground.?truth/i);
});

function createGeometryInput() {
  return {
    id: "format-2x3",
    gridDimensions: { rows: 2, cols: 3 },
    axes: {
      horizontal: { normalizedLinePositions: [0, 0.45, 1] },
      vertical: { normalizedLinePositions: [0, 0.3, 0.65, 1] }
    },
    provenance: { source: "test" }
  };
}
