import fs from "fs";
import { createShadowAnalysisRegionDiagnostics } from "./shadowAnalysisRegionDiagnostics";
import { runDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";

test("adapts the exact BinaryImage reference to the provider contract", () => {
  const binaryImage = createBinaryImage();
  const diagnostics = { type: "shadow-analysis-region-observations" };
  const runProviders = jest.fn(documentAnalysis => {
    expect(documentAnalysis).toEqual(expect.objectContaining({
      type: "document-analysis",
      version: 1,
      status: "measured"
    }));
    expect(documentAnalysis.binaryImage).toBe(binaryImage);
    expect(Object.isFrozen(documentAnalysis)).toBe(true);
    return diagnostics;
  });

  expect(createShadowAnalysisRegionDiagnostics(binaryImage, { runProviders }))
    .toBe(diagnostics);
  expect(runProviders).toHaveBeenCalledTimes(1);
});

test("runs through the existing benchmark path without changing its contract", async () => {
  const result = await runDigitizationExperimentBenchmark(createBinaryImage());
  const observation = result.experiments.find(experiment => (
    experiment.id === "shadow-analysis-region-observations"
  ));

  expect(observation).toEqual({
    id: "shadow-analysis-region-observations",
    description: expect.any(String),
    durationMs: expect.any(Number),
    success: true,
    diagnostics: expect.objectContaining({
      type: "shadow-analysis-region-observations",
      version: 1,
      status: "complete",
      providers: expect.any(Array)
    })
  });
});

test("keeps shadow-region modules independent of production orchestration, UI and persistence", () => {
  const moduleSources = [
    "./shadowAnalysisRegionDiagnostics",
    "./analysisRegions/shadowAnalysisRegionRunner",
    "./analysisRegions/shadowAnalysisRegionProviderRegistry",
    "./analysisRegions/horizontalOuterSpanAnalysisRegionProvider"
  ].map(modulePath => fs.readFileSync(require.resolve(modulePath), "utf8"));
  const productionSource = fs.readFileSync(
    require.resolve("../detection/imageGridDetectionOrchestrator"),
    "utf8"
  );

  for (const source of moduleSources) {
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(source).not.toMatch(/App|VisualizationRenderer|DevelopmentDatasetAnalysisView/);
    expect(source).not.toMatch(/createGridAnalysis|runImageGridDetection|detectGridFromImageSource/);
  }
  expect(productionSource).not.toMatch(/shadow|horizontalOuterSpan/i);
});

function createBinaryImage() {
  return {
    width: 5,
    height: 5,
    data: new Uint8Array([
      0, 0, 0, 0, 0,
      1, 1, 1, 1, 1,
      0, 0, 0, 0, 0,
      1, 1, 1, 1, 1,
      0, 0, 0, 0, 0
    ])
  };
}
