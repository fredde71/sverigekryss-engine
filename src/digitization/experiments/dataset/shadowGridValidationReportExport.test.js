import { createGridGroundTruth } from "./gridGroundTruth";
import { createShadowGridValidationReport } from "./shadowGridValidationReport";
import { createShadowGridValidationReportExport } from "./shadowGridValidationReportExport";

test("exports deterministic compact JSON with two spaces and one trailing newline", () => {
  const report = createReport();
  const first = createShadowGridValidationReportExport(report);
  const second = createShadowGridValidationReportExport(report);

  expect(second).toEqual(first);
  expect(first).toEqual({
    fileName: "shadow-grid-validation-tt-validation-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(report, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

test("contains no runtime image payloads", () => {
  const report = createReport();
  const serialized = createShadowGridValidationReportExport(report).contents;

  expect(serialized).not.toMatch(
    /binaryImage|imageData|canvas|projections|lineCandidates|Uint8Array/
  );
});

test("rejects incomplete or unrelated reports", () => {
  expect(() => createShadowGridValidationReportExport({
    type: "shadow-grid-validation-report",
    version: 1,
    status: "partial"
  })).toThrow("Completed version 1 shadow grid validation report is required");
});

function createReport() {
  const datasetReport = {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: {
      datasetId: "tt-validation"
    },
    items: [
      {
        id: "item-001",
        metadata: { filename: "one.pdf" },
        comparison: {
          status: "completed",
          result: {
            benchmark: {
              experiments: [
                {
                  id: "shadow-grid-analysis-diagnostics",
                  success: true,
                  diagnostics: {
                    providers: [
                      {
                        id: "provider",
                        status: "available",
                        regionCount: 1,
                        gridAnalyses: [
                          {
                            regionId: "region",
                            regionBounds: { top: 0, left: 0, width: 100, height: 100 },
                            status: "completed",
                            candidatePositions: {
                              horizontal: [10, 20],
                              vertical: [10, 20]
                            },
                            geometry: {
                              status: "available",
                              rows: 1,
                              cols: 1,
                              bounds: { top: 10, left: 10, width: 10, height: 10 }
                            }
                          }
                        ]
                      }
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    ]
  };
  const groundTruth = createGridGroundTruth({
    datasetId: "tt-validation",
    annotations: [
      {
        itemId: "item-001",
        filename: "one.pdf",
        document: { width: 100, height: 100 },
        gridBounds: { top: 10, left: 10, width: 10, height: 10 },
        horizontalLinePositions: [10, 20],
        verticalLinePositions: [10, 20],
        rows: 1,
        cols: 1,
        annotation: { status: "human-confirmed" }
      }
    ]
  });

  return createShadowGridValidationReport({ datasetReport, groundTruth });
}
