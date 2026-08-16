import {
  horizontalOuterSpanAnalysisRegionProvider,
  observeHorizontalOuterSpanAnalysisRegion
} from "./horizontalOuterSpanAnalysisRegionProvider";

test("observes the exact outer horizontal candidate bounds without creating geometry", () => {
  const binaryImage = createBinaryImage({
    width: 6,
    height: 8,
    darkRows: [1, 2, 5]
  });
  const sourceSnapshot = new Uint8Array(binaryImage.data);
  const result = observeHorizontalOuterSpanAnalysisRegion(
    createDocumentAnalysis(binaryImage)
  );

  expect(result.status).toBe("available");
  expect(result.reason).toBeNull();
  expect(result.regions).toHaveLength(1);
  expect(result.provenance).toEqual({
    source: "horizontal-image-evidence",
    method: "outermost-horizontal-candidate-runs",
    candidateCoverageRatio: 0.8,
    candidateCount: 2,
    candidatePositions: [1.5, 5]
  });

  const region = result.regions[0];

  expect(region.id).toBe("horizontal-outer-span-001");
  expect(region.regionType).toBe("shadow-observation");
  expect(region.bounds).toEqual({ top: 1, left: 0, width: 6, height: 5 });
  expect(region.dimensions).toEqual({ width: 6, height: 5 });
  expect(region.binaryImage).toEqual({
    width: 6,
    height: 5,
    data: binaryImage.data.subarray(6, 36)
  });
  expect(region.coordinateRelationship).toEqual({
    type: "translation",
    localToBinaryImage: { offsetX: 0, offsetY: 1, scaleX: 1, scaleY: 1 },
    binaryImageToLocal: { offsetX: 0, offsetY: -1, scaleX: 1, scaleY: 1 }
  });
  expect(findObjectKeys(result)).not.toEqual(expect.arrayContaining([
    "geometry",
    "confidence",
    "score",
    "rank",
    "selectedRegion",
    "preferredRegion",
    "recommendation"
  ]));
  expect(binaryImage.data).toEqual(sourceSnapshot);
});

test("uses the existing 0.8 horizontal coverage rule", () => {
  const data = new Uint8Array(5 * 5);

  setDarkPixels(data, 5, 1, 3);
  setDarkPixels(data, 5, 3, 5);

  const result = observeHorizontalOuterSpanAnalysisRegion(
    createDocumentAnalysis({ width: 5, height: 5, data })
  );

  expect(result.status).toBe("unavailable");
  expect(result.provenance.candidateCoverageRatio).toBe(0.8);
  expect(result.provenance.candidateCount).toBe(1);
  expect(result.provenance.candidatePositions).toEqual([3]);
});

test("preserves an explicit unavailable observation when fewer than two candidates exist", () => {
  const result = horizontalOuterSpanAnalysisRegionProvider.run(
    createDocumentAnalysis(createBinaryImage({
      width: 5,
      height: 4,
      darkRows: [2]
    }))
  );

  expect(result).toEqual({
    status: "unavailable",
    reason: "fewer-than-two-horizontal-candidates",
    regions: [],
    provenance: {
      source: "horizontal-image-evidence",
      method: "outermost-horizontal-candidate-runs",
      candidateCoverageRatio: 0.8,
      candidateCount: 1,
      candidatePositions: [2]
    },
    diagnostics: [
      {
        type: "horizontal-outer-span-analysis-region-observation",
        status: "unavailable",
        reason: "fewer-than-two-horizontal-candidates",
        provenance: {
          source: "horizontal-image-evidence",
          method: "outermost-horizontal-candidate-runs",
          candidateCoverageRatio: 0.8,
          candidateCount: 1,
          candidatePositions: [2]
        }
      }
    ]
  });
});

test("takes one stable BinaryImage data snapshot and accepts frozen runtime inputs", () => {
  const data = createBinaryImage({
    width: 5,
    height: 5,
    darkRows: [1, 3]
  }).data;
  let reads = 0;
  const binaryImage = Object.freeze({
    width: 5,
    height: 5,
    get data() {
      reads += 1;
      return data;
    }
  });
  const documentAnalysis = Object.freeze(createDocumentAnalysis(binaryImage));

  expect(() => observeHorizontalOuterSpanAnalysisRegion(documentAnalysis))
    .not.toThrow();
  expect(reads).toBe(1);
});

function createDocumentAnalysis(binaryImage) {
  return {
    type: "document-analysis",
    status: "measured",
    binaryImage
  };
}

function createBinaryImage({ width, height, darkRows }) {
  const data = new Uint8Array(width * height);

  for (const row of darkRows) {
    setDarkPixels(data, width, row, width);
  }

  return { width, height, data };
}

function setDarkPixels(data, width, row, count) {
  for (let x = 0; x < count; x++) {
    data[(row * width) + x] = 1;
  }
}

function findObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.flatMap(findObjectKeys);
  }

  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...findObjectKeys(nestedValue)
  ]);
}
