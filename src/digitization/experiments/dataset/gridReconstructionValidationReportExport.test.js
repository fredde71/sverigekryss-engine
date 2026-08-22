import { createGridGroundTruth } from "./gridGroundTruth";
import {
  createGridReconstructionValidationReport
} from "./gridReconstructionValidationReport";
import {
  createGridReconstructionValidationReportDownloader,
  createGridReconstructionValidationReportExport
} from "./gridReconstructionValidationReportExport";

test("exports deterministic JSON with two spaces and one trailing newline", () => {
  const report = createReport();
  const first = createGridReconstructionValidationReportExport(report);
  const second = createGridReconstructionValidationReportExport(report);

  expect(second).toEqual(first);
  expect(first).toEqual({
    fileName: "grid-reconstruction-validation-tt-export-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("contains no runtime image payloads", () => {
  const serialized = createGridReconstructionValidationReportExport(
    createReport()
  ).contents;

  expect(serialized).not.toMatch(
    /binaryImage|imageData|canvas|projections|lineCandidates|Uint8Array/
  );
});

test("rejects incomplete and unrelated reports", () => {
  expect(() => createGridReconstructionValidationReportExport({
    type: "grid-reconstruction-validation-report",
    version: 1,
    status: "partial"
  })).toThrow(
    "Completed version 1 grid reconstruction validation report is required"
  );
});

test("downloads through the existing deterministic export in development", () => {
  const report = createReport();
  const artifact = createGridReconstructionValidationReportExport(report);
  const anchor = { click: jest.fn() };
  const documentRef = { createElement: jest.fn(() => anchor) };
  const urlApi = {
    createObjectURL: jest.fn(() => "blob:reconstruction-validation"),
    revokeObjectURL: jest.fn()
  };
  const BlobCtor = jest.fn(function Blob(parts, options) {
    this.parts = parts;
    this.options = options;
  });
  const download = createGridReconstructionValidationReportDownloader({
    createExport: jest.fn(() => artifact),
    readEnvironment: () => "development",
    documentRef,
    urlApi,
    BlobCtor
  });

  expect(download(report)).toBe(artifact);
  expect(anchor.download).toBe(artifact.fileName);
  expect(anchor.href).toBe("blob:reconstruction-validation");
  expect(anchor.click).toHaveBeenCalledTimes(1);
  expect(urlApi.revokeObjectURL)
    .toHaveBeenCalledWith("blob:reconstruction-validation");
});

test("rejects browser downloads outside development and test", () => {
  const createExport = jest.fn();
  const download = createGridReconstructionValidationReportDownloader({
    createExport,
    readEnvironment: () => "production"
  });

  expect(() => download(createReport())).toThrow(
    "Grid reconstruction validation downloads are development-only"
  );
  expect(createExport).not.toHaveBeenCalled();
});

function createReport() {
  const hypothesis = {
    id: "variant-001",
    horizontalHypothesisId: "horizontal-001",
    verticalHypothesisId: "vertical-001",
    rows: 1,
    cols: 1,
    bounds: { top: 10, left: 10, width: 10, height: 10 },
    lines: {
      horizontal: [createLine(0, 10), createLine(1, 20)],
      vertical: [createLine(0, 10), createLine(1, 20)]
    },
    candidateAssignments: { horizontal: [], vertical: [] },
    diagnostics: []
  };
  const reconstruction = {
    type: "grid-reconstruction",
    version: 1,
    status: "available",
    coordinateSystem: {
      localToBinaryImage: {
        offsetX: 0,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1
      }
    },
    gridHypotheses: [hypothesis]
  };
  const datasetReport = {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "tt-export" },
    items: [{
      id: "item-001",
      metadata: { filename: "one.pdf" },
      comparison: {
        status: "completed",
        result: {
          benchmark: {
            experiments: [{
              id: "shadow-grid-reconstruction-diagnostics",
              success: true,
              diagnostics: {
                providers: [{
                  id: "provider",
                  status: "available",
                  reconstructions: [{
                    regionId: "region",
                    status: "completed",
                    reconstructionStatus: "available",
                    reconstruction
                  }]
                }]
              }
            }]
          }
        }
      }
    }]
  };
  const groundTruth = createGridGroundTruth({
    datasetId: "tt-export",
    annotations: [{
      itemId: "item-001",
      filename: "one.pdf",
      document: { width: 100, height: 100 },
      gridBounds: { top: 10, left: 10, width: 10, height: 10 },
      horizontalLinePositions: [10, 20],
      verticalLinePositions: [10, 20],
      rows: 1,
      cols: 1,
      annotation: { status: "human-confirmed" }
    }]
  });

  return createGridReconstructionValidationReport({
    datasetReport,
    groundTruth
  });
}

function createLine(index, position) {
  return {
    index,
    position,
    evidence: {
      status: "observed-aligned",
      candidateIndex: index,
      observedPosition: position,
      delta: 0
    }
  };
}
