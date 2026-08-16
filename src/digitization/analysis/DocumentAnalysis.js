import { thresholdRgbaImage } from "./BinaryImage";

const DOCUMENT_ANALYSIS_VERSION = 1;

export function createDocumentAnalysis({
  imageData,
  options = {}
} = {}) {
  const binaryImage = thresholdRgbaImage(imageData, {
    threshold: options.threshold
  });
  const documentWidth = getPositiveDimension(
    options.documentSize?.width,
    imageData.width
  );
  const documentHeight = getPositiveDimension(
    options.documentSize?.height,
    imageData.height
  );
  const coordinateRelationship = freezeValue({
    type: "axis-aligned-scale",
    binaryImageToDocument: {
      scaleX: documentWidth / binaryImage.width,
      scaleY: documentHeight / binaryImage.height
    }
  });
  const dimensions = freezeValue({
    document: {
      width: documentWidth,
      height: documentHeight
    },
    imageData: {
      width: imageData.width,
      height: imageData.height
    },
    binaryImage: {
      width: binaryImage.width,
      height: binaryImage.height
    }
  });
  const diagnostics = freezeValue([
    {
      type: "document-analysis",
      version: DOCUMENT_ANALYSIS_VERSION,
      status: "measured",
      dimensions,
      coordinateRelationship
    }
  ]);

  return Object.freeze({
    type: "document-analysis",
    version: DOCUMENT_ANALYSIS_VERSION,
    status: "measured",
    imageData,
    binaryImage,
    dimensions,
    coordinateRelationship,
    diagnostics
  });
}

export function mapBinaryImageGeometryToDocument(
  documentAnalysis,
  gridGeometry
) {
  if (!gridGeometry) {
    return null;
  }

  const {
    scaleX,
    scaleY
  } = documentAnalysis.coordinateRelationship.binaryImageToDocument;

  return {
    ...gridGeometry,
    bounds: {
      top: scaleCoordinate(gridGeometry.bounds.top, scaleY),
      left: scaleCoordinate(gridGeometry.bounds.left, scaleX),
      width: scaleCoordinate(gridGeometry.bounds.width, scaleX),
      height: scaleCoordinate(gridGeometry.bounds.height, scaleY)
    },
    horizontalLines: gridGeometry.horizontalLines.map(
      line => scaleCoordinate(line, scaleY)
    ),
    verticalLines: gridGeometry.verticalLines.map(
      line => scaleCoordinate(line, scaleX)
    )
  };
}

export function mapBinaryImagePointToDocument(documentAnalysis, point) {
  const {
    scaleX,
    scaleY
  } = documentAnalysis.coordinateRelationship.binaryImageToDocument;

  return {
    x: scaleCoordinate(point.x, scaleX),
    y: scaleCoordinate(point.y, scaleY)
  };
}

function getPositiveDimension(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function scaleCoordinate(value, scale) {
  return Number.isFinite(value) ? value * scale : value;
}

function freezeValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
