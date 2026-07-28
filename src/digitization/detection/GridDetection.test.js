import { createGridDetection } from "./GridDetection";

test("createGridDetection returns the detection result shape", () => {
  expect(createGridDetection({
    geometry: {
      bounds: {
        top: 0,
        left: 0,
        width: 10,
        height: 10
      }
    },
    confidence: "detected",
    diagnostics: ["ok"]
  })).toEqual({
    geometry: {
      bounds: {
        top: 0,
        left: 0,
        width: 10,
        height: 10
      }
    },
    confidence: "detected",
    diagnostics: ["ok"]
  });
});

test("createGridDetection clones and deeply freezes geometry and diagnostics", () => {
  const geometry = {
    bounds: {
      top: 0,
      left: 0,
      width: 10,
      height: 10
    },
    horizontalLines: [0, 10]
  };
  const diagnostics = [
    {
      message: "ok"
    }
  ];
  const detection = createGridDetection({
    geometry,
    confidence: "detected",
    diagnostics
  });

  geometry.bounds.top = 99;
  geometry.horizontalLines.push(20);
  diagnostics[0].message = "mutated";
  diagnostics.push("later");

  expect(detection.geometry.bounds.top).toBe(0);
  expect(detection.geometry.horizontalLines).toEqual([0, 10]);
  expect(detection.diagnostics).toEqual([
    {
      message: "ok"
    }
  ]);
  expect(Object.isFrozen(detection)).toBe(true);
  expect(Object.isFrozen(detection.geometry)).toBe(true);
  expect(Object.isFrozen(detection.geometry.bounds)).toBe(true);
  expect(Object.isFrozen(detection.geometry.horizontalLines)).toBe(true);
  expect(Object.isFrozen(detection.diagnostics)).toBe(true);
  expect(Object.isFrozen(detection.diagnostics[0])).toBe(true);
});

test("createGridDetection normalizes missing geometry to null", () => {
  expect(createGridDetection({
    geometry: undefined,
    confidence: "missing-grid-geometry"
  })).toEqual({
    geometry: null,
    confidence: "missing-grid-geometry",
    diagnostics: []
  });
});
