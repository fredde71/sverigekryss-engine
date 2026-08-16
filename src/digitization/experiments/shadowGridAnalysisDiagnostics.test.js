import fs from "fs";
import {
  createShadowGridAnalysisDiagnosticsRunner,
  runShadowGridAnalysisDiagnostics
} from "./shadowGridAnalysisDiagnostics";

test.each(["production", undefined, "preview"])(
  "rejects %p before observing regions or accessing runtime input",
  async environment => {
    const observeRegions = jest.fn();
    const run = createShadowGridAnalysisDiagnosticsRunner({
      observeRegions,
      readEnvironment: () => environment
    });
    const binaryImage = new Proxy({}, {
      get() {
        throw new Error("BinaryImage must not be accessed");
      }
    });

    await expect(run(binaryImage)).rejects.toThrow(
      "Shadow GridAnalysis is available only in development or test"
    );
    expect(observeRegions).not.toHaveBeenCalled();
  }
);

test.each(["development", "test"])("allows %s shadow GridAnalysis", async environment => {
  const run = createShadowGridAnalysisDiagnosticsRunner({
    observeRegions: async () => createProviderObservations([]),
    readEnvironment: () => environment
  });

  await expect(run(createBinaryImage())).resolves.toEqual({
    type: "shadow-grid-analysis-diagnostics",
    version: 1,
    status: "complete",
    providers: []
  });
});

test("skips unavailable and ambiguous providers without running GridAnalysis", async () => {
  const analyzeGrid = jest.fn();
  const unavailableRegion = createRegion("unavailable-region");
  const ambiguousRegions = [createRegion("ambiguous-a"), createRegion("ambiguous-b")];
  const run = createRunner({
    analyzeGrid,
    providers: [
      createProvider("unavailable", "unavailable", [unavailableRegion], "no-region"),
      createProvider("ambiguous", "ambiguous", ambiguousRegions, "multiple-regions")
    ]
  });

  const result = await run(createBinaryImage());

  expect(analyzeGrid).not.toHaveBeenCalled();
  expect(result.providers).toEqual([
    {
      id: "unavailable",
      description: "Provider unavailable",
      status: "unavailable",
      regionCount: 1,
      reason: "no-region",
      gridAnalyses: []
    },
    {
      id: "ambiguous",
      description: "Provider ambiguous",
      status: "ambiguous",
      regionCount: 2,
      reason: "multiple-regions",
      gridAnalyses: []
    }
  ]);
});

test("runs each available region exactly once in provider and region order", async () => {
  const regions = [
    createRegion("provider-a-region-1", { top: 10 }),
    createRegion("provider-a-region-2", { top: 20 }),
    createRegion("provider-b-region-1", { top: 30 })
  ];
  const calls = [];
  const analyzeGrid = jest.fn(async ({ analysisRegion }) => {
    calls.push(analysisRegion.id);
    return createGridAnalysisResult({ regionId: analysisRegion.id });
  });
  const run = createRunner({
    analyzeGrid,
    providers: [
      createProvider("provider-a", "available", regions.slice(0, 2)),
      createProvider("provider-b", "available", regions.slice(2))
    ],
    times: [0, 1, 2, 3, 4, 5]
  });

  const result = await run(createBinaryImage());

  expect(calls).toEqual([
    "provider-a-region-1",
    "provider-a-region-2",
    "provider-b-region-1"
  ]);
  expect(analyzeGrid).toHaveBeenCalledTimes(3);
  regions.forEach(region => {
    expect(analyzeGrid).toHaveBeenCalledWith({ analysisRegion: region });
  });
  expect(result.providers.map(provider => provider.id)).toEqual([
    "provider-a",
    "provider-b"
  ]);
  expect(result.providers[0].gridAnalyses.map(result => result.regionId)).toEqual([
    "provider-a-region-1",
    "provider-a-region-2"
  ]);
  expect(result.providers[1].gridAnalyses.map(result => result.regionId)).toEqual([
    "provider-b-region-1"
  ]);
});

test("preserves compact candidates, spacing and region-local geometry observations", async () => {
  const region = createRegion("measured-region", {
    top: 12,
    left: 4,
    width: 40,
    height: 30
  });
  const spacingDiagnostics = [
    {
      type: "spacing-consistency",
      axis: "horizontal",
      status: "measured",
      consistency: 0.9,
      min: 9,
      max: 11,
      average: 10
    },
    {
      type: "spacing-consistency",
      axis: "vertical",
      status: "measured",
      consistency: 1,
      min: 10,
      max: 10,
      average: 10
    }
  ];
  const analyzeGrid = jest.fn(async () => createGridAnalysisResult({
    horizontalPositions: [1, 11, 21],
    verticalPositions: [2, 12, 22, 32],
    geometry: {
      rows: 2,
      cols: 3,
      bounds: { top: 1, left: 2, width: 30, height: 20 }
    },
    diagnostics: spacingDiagnostics
  }));
  const run = createRunner({
    analyzeGrid,
    providers: [createProvider("provider", "available", [region])],
    times: [10, 12.5]
  });

  const result = await run(createBinaryImage());

  expect(result.providers[0].gridAnalyses[0]).toEqual({
    providerId: "provider",
    regionId: "measured-region",
    regionBounds: { top: 12, left: 4, width: 40, height: 30 },
    regionDimensions: { width: 40, height: 30 },
    status: "completed",
    gridAnalysisStatus: "measured",
    durationMs: 2.5,
    candidateCounts: { horizontal: 3, vertical: 4 },
    candidatePositions: {
      horizontal: [1, 11, 21],
      vertical: [2, 12, 22, 32]
    },
    spacingDiagnostics,
    geometry: {
      status: "available",
      rows: 2,
      cols: 3,
      bounds: { top: 1, left: 2, width: 30, height: 20 }
    },
    rejectionReasons: [],
    error: null
  });
});

test("preserves rejection reasons when region-local geometry is unavailable", async () => {
  const rejectionReasons = [
    {
      type: "rejection-reason",
      code: "insufficient-candidates",
      axis: "vertical",
      candidateCount: 1,
      minimumCount: 2
    }
  ];
  const run = createRunner({
    analyzeGrid: async () => createGridAnalysisResult({
      horizontalPositions: [1, 10],
      verticalPositions: [3],
      geometry: null,
      diagnostics: rejectionReasons
    }),
    providers: [createProvider("provider", "available", [createRegion("rejected")])],
    times: [5, 6]
  });

  const observation = (await run(createBinaryImage()))
    .providers[0].gridAnalyses[0];

  expect(observation.geometry).toEqual({
    status: "unavailable",
    rows: null,
    cols: null,
    bounds: null
  });
  expect(observation.rejectionReasons).toEqual([
    {
      code: "insufficient-candidates",
      axis: "vertical",
      candidateCount: 1,
      minimumCount: 2
    }
  ]);
});

test("isolates a region failure and continues with later regions", async () => {
  const regions = [createRegion("failed"), createRegion("later")];
  const analyzeGrid = jest.fn(async ({ analysisRegion }) => {
    if (analysisRegion.id === "failed") {
      throw new TypeError("synthetic GridAnalysis failure");
    }

    return createGridAnalysisResult({ regionId: analysisRegion.id });
  });
  const run = createRunner({
    analyzeGrid,
    providers: [createProvider("provider", "available", regions)],
    times: [0, 2, 3, 4]
  });

  const result = await run(createBinaryImage());

  expect(result.providers[0].gridAnalyses[0]).toEqual(expect.objectContaining({
    providerId: "provider",
    regionId: "failed",
    status: "failed",
    gridAnalysisStatus: "failed",
    durationMs: 2,
    error: {
      name: "TypeError",
      message: "synthetic GridAnalysis failure"
    }
  }));
  expect(result.providers[0].gridAnalyses[1]).toEqual(expect.objectContaining({
    regionId: "later",
    status: "completed",
    durationMs: 1
  }));
  expect(analyzeGrid).toHaveBeenCalledTimes(2);
});

test("the registered implementation returns compact diagnostics without runtime payloads or evaluation fields", async () => {
  const result = await runShadowGridAnalysisDiagnostics(createBinaryImage());
  const keys = findObjectKeys(result);

  expect(result.providers).toHaveLength(1);
  expect(keys).not.toEqual(expect.arrayContaining([
    "binaryImage",
    "projections",
    "lineCandidates",
    "rank",
    "ranking",
    "score",
    "preferredRegion",
    "selectedRegion",
    "recommendation"
  ]));
});

test("keeps Phase 4 independent of production orchestration, UI and persistence", () => {
  const source = fs.readFileSync(
    require.resolve("./shadowGridAnalysisDiagnostics"),
    "utf8"
  );
  const productionSource = fs.readFileSync(
    require.resolve("../detection/imageGridDetectionOrchestrator"),
    "utf8"
  );

  expect(source).not.toMatch(/detectGridFromImageSource|createGridDetection|suggestions/);
  expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  expect(source).not.toMatch(/App|VisualizationRenderer|DevelopmentDatasetAnalysisView/);
  expect(productionSource).not.toMatch(/shadowGrid|shadow-grid/i);
});

function createRunner({
  providers,
  analyzeGrid,
  times = []
}) {
  const remainingTimes = times.slice();

  return createShadowGridAnalysisDiagnosticsRunner({
    observeRegions: async () => createProviderObservations(providers),
    analyzeGrid,
    now: () => remainingTimes.shift() ?? 0,
    readEnvironment: () => "test"
  });
}

function createProvider(id, status, regions, reason = null) {
  return {
    id,
    description: `Provider ${id}`,
    status,
    regionCount: regions.length,
    regions,
    reason
  };
}

function createProviderObservations(providers) {
  return {
    type: "shadow-analysis-region-observations",
    version: 1,
    status: "complete",
    providers
  };
}

function createRegion(id, bounds = {}) {
  const resolvedBounds = {
    top: 0,
    left: 0,
    width: 5,
    height: 5,
    ...bounds
  };

  return Object.freeze({
    type: "analysis-region",
    id,
    status: "measured",
    regionType: "shadow-observation",
    bounds: Object.freeze(resolvedBounds),
    dimensions: Object.freeze({
      width: resolvedBounds.width,
      height: resolvedBounds.height
    }),
    binaryImage: Object.freeze(createBinaryImage())
  });
}

function createGridAnalysisResult({
  horizontalPositions = [1, 3],
  verticalPositions = [1, 3],
  geometry = null,
  diagnostics = []
} = {}) {
  return {
    type: "grid-analysis",
    status: "measured",
    analysisDimensions: { width: 5, height: 5 },
    projections: {
      horizontal: new Uint32Array(5),
      vertical: new Uint32Array(5)
    },
    lineCandidates: {
      horizontal: horizontalPositions.map(position => ({ position })),
      vertical: verticalPositions.map(position => ({ position }))
    },
    gridGeometry: geometry,
    diagnostics
  };
}

function createBinaryImage() {
  return {
    width: 5,
    height: 5,
    data: new Uint8Array([
      1, 1, 1, 1, 1,
      1, 0, 0, 0, 1,
      1, 0, 0, 0, 1,
      1, 0, 0, 0, 1,
      1, 1, 1, 1, 1
    ])
  };
}

function findObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.flatMap(findObjectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...findObjectKeys(nestedValue)
  ]);
}
