import { createAnalysisContext, withGridGeometry } from "../analysis/AnalysisContext";
import {
  createSuggestionFromAnalysisContext,
  createSuggestionFromGridDetection,
  detectGridFromAnalysisContext
} from "./gridDetectionEngine";

test("detectGridFromAnalysisContext accepts a plain context-shaped object", () => {
  const geometry = {
    bounds: {
      top: 0,
      left: 0,
      width: 100,
      height: 80
    },
    rows: null,
    cols: null
  };

  const context = detectGridFromAnalysisContext({
    gridGeometry: geometry
  });

  expect(context.gridDetection).toEqual({
    geometry,
    confidence: "provided-grid-geometry",
    diagnostics: []
  });
});

test("detectGridFromAnalysisContext returns a new immutable context", () => {
  const context = withGridGeometry(createAnalysisContext(), {
    bounds: {
      top: 0,
      left: 0,
      width: 100,
      height: 80
    }
  });

  const next = detectGridFromAnalysisContext(context);

  expect(next).not.toBe(context);
  expect(context.gridDetection).toBeNull();
  expect(Object.isFrozen(next)).toBe(true);
  expect(Object.isFrozen(next.gridDetection)).toBe(true);
});

test("detectGridFromAnalysisContext supports injected detection while preserving context", () => {
  const geometry = {
    bounds: {
      top: 0,
      left: 0,
      width: 100,
      height: 80
    }
  };
  const detectGrid = jest.fn(() => ({
    geometry,
    confidence: "detected",
    diagnostics: ["ok"]
  }));

  const context = detectGridFromAnalysisContext(createAnalysisContext(), {
    detectGrid
  });

  expect(detectGrid).toHaveBeenCalledTimes(1);
  expect(context.gridDetection).toEqual({
    geometry,
    confidence: "detected",
    diagnostics: ["ok"]
  });
});

test("detectGridFromAnalysisContext preserves typed arrays from existing contexts", () => {
  const context = detectGridFromAnalysisContext({
    imageData: {
      data: new Uint8Array([1, 2, 3])
    },
    gridGeometry: {
      bounds: {
        top: 0,
        left: 0,
        width: 100,
        height: 80
      }
    }
  });

  expect(context.imageData.data instanceof Uint8Array).toBe(true);
  expect(ArrayBuffer.isView(context.imageData.data)).toBe(true);
  expect(Array.from(context.imageData.data)).toEqual([1, 2, 3]);
});

test("detectGridFromAnalysisContext preserves typed arrays when reusing an AnalysisContext", () => {
  const initial = createAnalysisContext({
    imageData: {
      data: new Uint8Array([1, 2, 3])
    },
    gridGeometry: {
      bounds: {
        top: 0,
        left: 0,
        width: 100,
        height: 80
      }
    }
  });

  const context = detectGridFromAnalysisContext(initial);

  expect(context.imageData.data instanceof Uint8Array).toBe(true);
  expect(ArrayBuffer.isView(context.imageData.data)).toBe(true);
  expect(Array.from(context.imageData.data)).toEqual([1, 2, 3]);
});

test("detectGridFromAnalysisContext reports missing grid geometry without assumptions", () => {
  const context = detectGridFromAnalysisContext(createAnalysisContext());

  expect(context.gridDetection).toEqual({
    geometry: null,
    confidence: "missing-grid-geometry",
    diagnostics: ["AnalysisContext has no gridGeometry"]
  });
});

test("createSuggestionFromGridDetection is the bridge to DigitizationSuggestion shape", () => {
  const geometry = {
    bounds: {
      top: 0,
      left: 0,
      width: 100,
      height: 80
    }
  };
  const diagnostics = ["line candidates accepted"];
  const suggestion = createSuggestionFromGridDetection({
    source: {
      id: "source-1"
    },
    gridDetection: {
      geometry,
      confidence: "detected",
      diagnostics
    }
  });

  geometry.bounds.top = 99;
  diagnostics.push("mutated");

  expect(suggestion).toEqual({
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
    diagnostics: ["line candidates accepted"]
  });
  expect(Object.isFrozen(suggestion)).toBe(true);
  expect(Object.isFrozen(suggestion.grid)).toBe(true);
  expect(Object.isFrozen(suggestion.grid.bounds)).toBe(true);
  expect(Object.isFrozen(suggestion.diagnostics)).toBe(true);
});

test("createSuggestionFromAnalysisContext uses gridDetection from context", () => {
  const context = detectGridFromAnalysisContext({
    gridGeometry: {
      bounds: {
        top: 0,
        left: 0,
        width: 100,
        height: 80
      }
    }
  });

  expect(
    createSuggestionFromAnalysisContext({
      source: {
        id: "source-1"
      },
      context
    })
  ).toMatchObject({
    sourceId: "source-1",
    confidence: "provided-grid-geometry"
  });
});
