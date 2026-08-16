import { createShadowAnalysisRegionRunner } from "./shadowAnalysisRegionRunner";

test("preserves provider order and zero, one and multiple region states", () => {
  const zeroResult = createProviderResult("unavailable", []);
  const oneRegion = { id: "one" };
  const oneResult = createProviderResult("available", [oneRegion]);
  const multipleRegions = [{ id: "first" }, { id: "second" }];
  const multipleResult = createProviderResult("ambiguous", multipleRegions);
  const providers = [
    createProvider("zero", zeroResult),
    createProvider("one", oneResult),
    createProvider("multiple", multipleResult)
  ];
  const run = createShadowAnalysisRegionRunner({
    listProviders: () => providers,
    readEnvironment: () => "test"
  });
  const documentAnalysis = createDocumentAnalysis();
  const result = run(documentAnalysis);

  expect(result.providers.map(provider => provider.id)).toEqual([
    "zero",
    "one",
    "multiple"
  ]);
  expect(result.providers.map(provider => provider.status)).toEqual([
    "unavailable",
    "available",
    "ambiguous"
  ]);
  expect(result.providers.map(provider => provider.regionCount)).toEqual([0, 1, 2]);
  expect(result.providers[1].regions).toBe(oneResult.regions);
  expect(result.providers[1].regions[0]).toBe(oneRegion);
  expect(result.providers[2].regions).toBe(multipleResult.regions);
  expect(result.providers[2].regions).toEqual(multipleRegions);
  providers.forEach(provider => {
    expect(provider.run).toHaveBeenCalledTimes(1);
    expect(provider.run).toHaveBeenCalledWith(documentAnalysis);
  });
});

test.each(["production", undefined, "preview"])(
  "rejects %p before provider listing or DocumentAnalysis access",
  environment => {
    const listProviders = jest.fn();
    const documentAnalysis = new Proxy({}, {
      get() {
        throw new Error("DocumentAnalysis must not be accessed");
      }
    });
    const run = createShadowAnalysisRegionRunner({
      listProviders,
      readEnvironment: () => environment
    });

    expect(() => run(documentAnalysis)).toThrow(
      "Shadow AnalysisRegion providers are available only in development or test"
    );
    expect(listProviders).not.toHaveBeenCalled();
  }
);

test.each(["development", "test"])("allows %s execution", environment => {
  const run = createShadowAnalysisRegionRunner({
    listProviders: () => [],
    readEnvironment: () => environment
  });

  expect(run(createDocumentAnalysis())).toEqual({
    type: "shadow-analysis-region-observations",
    version: 1,
    status: "complete",
    providers: []
  });
});

test("isolates provider failures and continues in deterministic order", () => {
  const later = createProvider("later", createProviderResult("available", []));
  const run = createShadowAnalysisRegionRunner({
    listProviders: () => [
      createProvider("failed", null, () => {
        throw new TypeError("synthetic provider failure");
      }),
      later
    ],
    readEnvironment: () => "test"
  });

  const result = run(createDocumentAnalysis());

  expect(result.providers[0]).toEqual({
    id: "failed",
    description: "Provider failed",
    status: "failed",
    regionCount: 0,
    regions: [],
    provenance: null,
    diagnostics: [],
    reason: {
      name: "TypeError",
      message: "synthetic provider failure"
    }
  });
  expect(result.providers[1].id).toBe("later");
  expect(later.run).toHaveBeenCalledTimes(1);
});

function createProvider(id, result, implementation = () => result) {
  return {
    id,
    description: `Provider ${id}`,
    run: jest.fn(implementation)
  };
}

function createProviderResult(status, regions) {
  return {
    status,
    reason: status === "available" ? null : `${status}-reason`,
    regions,
    provenance: { source: "synthetic" },
    diagnostics: [{ type: "synthetic" }]
  };
}

function createDocumentAnalysis() {
  return Object.freeze({
    type: "document-analysis",
    status: "measured",
    binaryImage: Object.freeze({
      width: 1,
      height: 1,
      data: new Uint8Array([0])
    })
  });
}
