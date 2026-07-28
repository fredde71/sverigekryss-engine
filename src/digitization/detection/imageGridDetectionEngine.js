import {
  createAnalysisContext,
  withBinaryImage,
  withGridGeometry,
  withImageData,
  withLineCandidates,
  withProjections
} from "../analysis/AnalysisContext";
import { thresholdRgbaImage } from "../analysis/BinaryImage";
import {
  createHorizontalProjection,
  createVerticalProjection
} from "../analysis/Projection";
import { findLineCandidates } from "../analysis/LineCandidate";
import { buildGridGeometry } from "../analysis/GridGeometry";
import { createGridDetection } from "./GridDetection";
import {
  createSuggestionFromAnalysisContext,
  detectGridFromAnalysisContext
} from "./gridDetectionEngine";

export async function detectGridFromImageSource({
  source,
  options = {},
  readImageData
}) {
  if (typeof readImageData !== "function") {
    throw new Error("readImageData is required");
  }

  const imageData = await readImageData(source);
  const binaryImage = thresholdRgbaImage(imageData, {
    threshold: options.threshold
  });
  const projections = {
    horizontal: createHorizontalProjection(binaryImage),
    vertical: createVerticalProjection(binaryImage)
  };
  const lineCandidates = {
    horizontal: findLineCandidates(projections.horizontal, {
      axis: "horizontal",
      axisLength: binaryImage.width,
      minCoverageRatio: options.minLineCoverageRatio
    }),
    vertical: findLineCandidates(projections.vertical, {
      axis: "vertical",
      axisLength: binaryImage.height,
      minCoverageRatio: options.minLineCoverageRatio
    })
  };
  const gridGeometry = buildGridGeometry({
    horizontalCandidates: lineCandidates.horizontal,
    verticalCandidates: lineCandidates.vertical
  });
  const gridDiagnostics = [];

  if (!gridGeometry) {
    gridDiagnostics.push("Grid geometry was not detected");
  }

  const analysisContext = withGridGeometry(
    withLineCandidates(
      withProjections(
        withBinaryImage(
          withImageData(
            createAnalysisContext(),
            imageData
          ),
          binaryImage
        ),
        projections
      ),
      lineCandidates
    ),
    gridGeometry
  );
  const detectedContext = detectGridFromAnalysisContext(analysisContext, {
    detectGrid: context => createGridDetection({
      geometry: context.gridGeometry,
      confidence: context.gridGeometry ? "detected" : "missing-grid-geometry",
      diagnostics: gridDiagnostics
    })
  });
  const suggestions = detectedContext.gridDetection.geometry
    ? [
      createSuggestionFromAnalysisContext({
        source,
        context: detectedContext
      })
    ]
    : [];

  return {
    context: detectedContext,
    gridDetection: detectedContext.gridDetection,
    suggestions,
    diagnostics: detectedContext.gridDetection.diagnostics
  };
}
