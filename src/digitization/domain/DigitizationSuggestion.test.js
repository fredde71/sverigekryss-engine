import { createDigitizationSuggestion } from "./DigitizationSuggestion";

test("createDigitizationSuggestion returns the minimal domain object", () => {
  expect(
    createDigitizationSuggestion({
      sourceId: "source-1",
      grid: {
        bounds: {
          top: 0,
          left: 0,
          width: 100,
          height: 80
        }
      },
      confidence: "detected",
      diagnostics: ["ok"]
    })
  ).toEqual({
    sourceId: "source-1",
    grid: {
      bounds: {
        top: 0,
        left: 0,
        width: 100,
        height: 80
      }
    },
    confidence: "detected",
    diagnostics: ["ok"]
  });
});

test("createDigitizationSuggestion deeply freezes nested values", () => {
  const suggestion = createDigitizationSuggestion({
    sourceId: "source-1",
    grid: {
      bounds: {
        top: 0,
        left: 0,
        width: 100,
        height: 80
      }
    },
    diagnostics: ["ok"]
  });

  expect(Object.isFrozen(suggestion)).toBe(true);
  expect(Object.isFrozen(suggestion.grid)).toBe(true);
  expect(Object.isFrozen(suggestion.grid.bounds)).toBe(true);
  expect(Object.isFrozen(suggestion.diagnostics)).toBe(true);
});

test("createDigitizationSuggestion clones grid and diagnostics defensively", () => {
  const grid = {
    bounds: {
      top: 0,
      left: 0,
      width: 100,
      height: 80
    }
  };
  const diagnostics = ["ok"];
  const suggestion = createDigitizationSuggestion({
    sourceId: "source-1",
    grid,
    diagnostics
  });

  grid.bounds.top = 99;
  diagnostics.push("mutated");

  expect(suggestion.grid.bounds.top).toBe(0);
  expect(suggestion.diagnostics).toEqual(["ok"]);
});

test("createDigitizationSuggestion protects typed arrays with defensive copies", () => {
  const suggestion = createDigitizationSuggestion({
    sourceId: "source-1",
    grid: {
      projection: new Uint8Array([1, 2, 3])
    }
  });
  const projection = suggestion.grid.projection;

  projection[0] = 9;

  expect(projection instanceof Uint8Array).toBe(true);
  expect(ArrayBuffer.isView(projection)).toBe(true);
  expect(suggestion.grid.projection[0]).toBe(1);
});
