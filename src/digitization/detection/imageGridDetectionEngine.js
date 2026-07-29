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
  const gridGeometry = normalizeGridGeometryForDocument(
    buildGridGeometry({
      horizontalCandidates: lineCandidates.horizontal,
      verticalCandidates: lineCandidates.vertical
    }),
    {
      imageWidth: imageData.width,
      imageHeight: imageData.height,
      documentSize: options.documentSize
    }
  );

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

function normalizeGridGeometryForDocument(gridGeometry, {
  imageWidth,
  imageHeight,
  documentSize
}) {
  if (!gridGeometry) {
    return null;
  }

  const targetWidth = getPositiveDimension(documentSize?.width, imageWidth);
  const targetHeight = getPositiveDimension(documentSize?.height, imageHeight);
  const scaleX = targetWidth / imageWidth;
  const scaleY = targetHeight / imageHeight;

  return {
    ...gridGeometry,
    bounds: {
      top: scaleCoordinate(gridGeometry.bounds.top, scaleY),
      left: scaleCoordinate(gridGeometry.bounds.left, scaleX),
      width: scaleCoordinate(gridGeometry.bounds.width, scaleX),
      height: scaleCoordinate(gridGeometry.bounds.height, scaleY)
    },
    horizontalLines: gridGeometry.horizontalLines.map(line => scaleCoordinate(line, scaleY)),
    verticalLines: gridGeometry.verticalLines.map(line => scaleCoordinate(line, scaleX))
  };
}

function getPositiveDimension(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function scaleCoordinate(value, scale) {
  return Number.isFinite(value) ? value * scale : value;
}
