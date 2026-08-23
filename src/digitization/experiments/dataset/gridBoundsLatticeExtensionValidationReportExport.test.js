import { createGridGroundTruth } from "./gridGroundTruth";
import {
  createGridBoundsLatticeExtensionValidationReport
} from "./gridBoundsLatticeExtensionValidationReport";
import {
  createGridBoundsLatticeExtensionValidationReportExport
} from "./gridBoundsLatticeExtensionValidationReportExport";

test("exports deterministic two-space JSON with one trailing newline", () => {
  const report = createReport();
  const first = createGridBoundsLatticeExtensionValidationReportExport(report);
  const second = createGridBoundsLatticeExtensionValidationReportExport(report);

  expect(second).toEqual(first);
  expect(first).toEqual({
    fileName:
      "grid-bounds-lattice-extension-validation-tt-export-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("exports every observation and excludes runtime payloads", () => {
  const artifact = createGridBoundsLatticeExtensionValidationReportExport(
    createReport()
  );
  const parsed = JSON.parse(artifact.contents);

  expect(parsed.items[0].providers[0].regions[0].observations.map(
    observation => observation.observationId
  )).toEqual(["first", "second"]);
  expect(artifact.contents).not.toMatch(
    /binaryImage|imageData|canvas|projections|lineCandidates|Uint8Array/
  );
});

test("rejects incomplete and unrelated reports", () => {
  expect(() => createGridBoundsLatticeExtensionValidationReportExport({
    type: "grid-bounds-lattice-extension-validation-report",
    version: 1,
    status: "partial"
  })).toThrow(
    "Completed version 1 grid bounds lattice extension validation report is required"
  );
});

function createReport() {
  const observations = [
    createObservation("first", { top: 0, left: 0, width: 20, height: 20 }),
    createObservation("second", { top: 1, left: 1, width: 19, height: 19 })
  ];
  const datasetReport = {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "tt-export" },
    items: [{
      id: "item-a",
      metadata: { filename: "a.pdf" },
      comparison: {
        status: "completed",
        result: {
          benchmark: {
            experiments: [{
              id: "shadow-grid-bounds-lattice-extension-diagnostics",
              success: true,
              diagnostics: {
                status: "complete",
                providers: [{
                  id: "provider",
                  status: "available",
                  boundsObservations: [{
                    regionId: "region",
                    status: "completed",
                    boundsObservation: {
                      status: "ambiguous",
                      coordinateSystem: {
                        localToBinaryImage: {
                          offsetX: 50,
                          offsetY: 100,
                          scaleX: 1,
                          scaleY: 1
                        }
                      },
                      provenance: { source: "extension-experiment" },
                      sourceAcceptedCandidateEnvelope: {
                        status: "available",
                        bounds: { top: 2, left: 2, width: 16, height: 16 }
                      },
                      observations,
                      reasons: [{ code: "multiple-compatible-observations" }]
                    }
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
      itemId: "item-a",
      filename: "a.pdf",
      document: { width: 500, height: 700 },
      gridBounds: { top: 100, left: 50, width: 20, height: 20 },
      horizontalLinePositions: [100, 120],
      verticalLinePositions: [50, 70],
      rows: 1,
      cols: 1,
      annotation: { status: "human-confirmed" }
    }]
  });

  return createGridBoundsLatticeExtensionValidationReport({
    datasetReport,
    groundTruth
  });
}

function createObservation(id, bounds) {
  return {
    id,
    status: "available",
    bounds,
    inferredOuterIntervals: { top: 1, left: 1, right: 1, bottom: 1 },
    spacingUsed: { horizontal: 10, vertical: 10 },
    provenance: { source: "shadow-grid-reconstruction-diagnostics" },
    evidenceReferences: [],
    assumptions: [],
    reasons: [],
    diagnostics: []
  };
}
