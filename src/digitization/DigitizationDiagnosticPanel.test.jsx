import { render, screen } from "@testing-library/react";
import DigitizationDiagnosticPanel from "./DigitizationDiagnosticPanel";

test("DigitizationDiagnosticPanel shows no-result state", () => {
  const { container } = render(<DigitizationDiagnosticPanel digitizationResult={null} />);

  expect(screen.getByLabelText("Digitiseringsdiagnostik")).toHaveTextContent("Status: Ingen analys körd");
  expect(screen.getByLabelText("Digitiseringsdiagnostik")).toHaveTextContent("Status: Ingen bildanalys har körts.");
  expect(screen.getByLabelText("Digitiseringsdiagnostik")).toHaveTextContent("Nästa steg: Ladda upp en bild eller PDF för att se en rutnätsförhandsvisning.");
  expect(screen.getByLabelText("Digitiseringsdiagnostik")).toHaveTextContent("Förslag: Inga förslag");
  expect(screen.getByLabelText("Digitiseringsdiagnostik")).toHaveTextContent("Konfidens: Saknas");
  expect(screen.getByText("Utvecklardetaljer")).toBeInTheDocument();
  expect(container.querySelector("details")).not.toHaveAttribute("open");
});

test("DigitizationDiagnosticPanel shows successful suggestion diagnostics defensively", () => {
  const { container } = render(
    <DigitizationDiagnosticPanel
      digitizationResult={{
        status: "completed",
        result: {
          suggestions: [
            {
              confidence: "detected",
              diagnostics: ["line candidates accepted"],
              grid: {
                rows: 2,
                cols: 3,
                bounds: {
                  top: 1,
                  left: 2,
                  width: 30,
                  height: 20
                },
                horizontalLines: [1, 11, 21],
                verticalLines: [2, 12, 22, 32]
              }
            }
          ],
          gridDetection: {
            confidence: "provided-grid-geometry",
            diagnostics: ["fallback reason"]
          }
        }
      }}
    />
  );

  const panel = screen.getByLabelText("Digitiseringsdiagnostik");

  expect(panel).toHaveTextContent("Status: Rutnät hittat.");
  expect(panel).toHaveTextContent("Nästa steg: Granska förhandsvisningen och justera manuellt vid behov.");
  expect(container.querySelector("details")).not.toHaveAttribute("open");
  expect(panel).toHaveTextContent("Status: Analys klar");
  expect(panel).toHaveTextContent("Förslag: Förslag finns");
  expect(panel).toHaveTextContent("Konfidens: detected");
  expect(panel).toHaveTextContent("Orsaker: line candidates accepted");
  expect(panel).toHaveTextContent("Mått: horisontella linjer 3, vertikala linjer 4");
  expect(panel).toHaveTextContent("Rader/kolumner: 2 x 3");
  expect(panel).toHaveTextContent("Geometri: top 1, left 2, width 30, height 20");
});

test("DigitizationDiagnosticPanel exposes publisher grid diagnostics", () => {
  const { container } = render(
    <DigitizationDiagnosticPanel
      digitizationResult={{
        status: "completed",
        result: {
          suggestions: [
            {
              confidence: "detected",
              diagnostics: [
                {
                  type: "candidate-counts",
                  axis: "horizontal",
                  acceptedCount: 12,
                  rejectedCount: 4,
                  totalCount: 16
                },
                {
                  type: "candidate-counts",
                  axis: "vertical",
                  acceptedCount: 10,
                  rejectedCount: 6,
                  totalCount: 16
                },
                {
                  type: "spacing-consistency",
                  axis: "horizontal",
                  status: "measured",
                  consistency: 0.94,
                  min: 19,
                  max: 21,
                  average: 20
                },
                {
                  type: "pre-rejection-bounds",
                  bounds: {
                    top: 8,
                    left: 12,
                    width: 420,
                    height: 500
                  }
                },
                {
                  type: "rejection-reasons",
                  reasons: []
                },
                {
                  type: "acceptance-status",
                  accepted: true
                }
              ],
              grid: {
                rows: 11,
                cols: 9,
                bounds: {
                  top: 8,
                  left: 12,
                  width: 420,
                  height: 500
                },
                horizontalLines: [8, 28],
                verticalLines: [12, 32]
              }
            }
          ]
        }
      }}
    />
  );

  const panel = screen.getByLabelText("Digitiseringsdiagnostik");

  expect(container.querySelector("details")).not.toHaveAttribute("open");
  expect(panel).toHaveTextContent("Horisontella kandidater: accepterade 12, avvisade 4, totalt 16");
  expect(panel).toHaveTextContent("Vertikala kandidater: accepterade 10, avvisade 6, totalt 16");
  expect(panel).toHaveTextContent("Horisontell avståndsjämnhet: 0.94");
  expect(panel).toHaveTextContent("Detekterade gränser före avvisning: top 8, left 12, width 420, height 500");
  expect(panel).toHaveTextContent("Avvisningsorsaker: inga");
  expect(panel).toHaveTextContent("Grid accepterat");
});

test("DigitizationDiagnosticPanel formats vertical projection profile diagnostics readably", () => {
  render(
    <DigitizationDiagnosticPanel
      digitizationResult={{
        status: "completed",
        result: {
          suggestions: [
            {
              confidence: "detected",
              diagnostics: [
                {
                  type: "vertical-projection-profile",
                  length: 8,
                  maxStrength: 7,
                  meanStrength: 2.5,
                  medianStrength: 2,
                  runCount: 6,
                  topPeaks: [
                    { position: 3, strength: 7 },
                    { position: 1, strength: 6 },
                    { position: 5, strength: 5 },
                    { position: 0, strength: 4 },
                    { position: 2, strength: 3 },
                    { position: 7, strength: 2 }
                  ],
                  topRuns: [
                    {
                      start: 3,
                      end: 4,
                      maxStrength: 7,
                      meanStrength: 6,
                      maxCoverage: 0.7,
                      meanCoverage: 0.6
                    },
                    {
                      start: 1,
                      end: 1,
                      maxStrength: 6,
                      meanStrength: 6,
                      maxCoverage: 0.6,
                      meanCoverage: 0.6
                    },
                    {
                      start: 5,
                      end: 5,
                      maxStrength: 5,
                      meanStrength: 5,
                      maxCoverage: 0.5,
                      meanCoverage: 0.5
                    },
                    {
                      start: 0,
                      end: 0,
                      maxStrength: 4,
                      meanStrength: 4,
                      maxCoverage: 0.4,
                      meanCoverage: 0.4
                    },
                    {
                      start: 2,
                      end: 2,
                      maxStrength: 3,
                      meanStrength: 3,
                      maxCoverage: 0.3,
                      meanCoverage: 0.3
                    },
                    {
                      start: 7,
                      end: 7,
                      maxStrength: 2,
                      meanStrength: 2,
                      maxCoverage: 0.2,
                      meanCoverage: 0.2
                    }
                  ]
                }
              ],
              grid: {
                rows: 2,
                cols: 2,
                bounds: {
                  top: 0,
                  left: 0,
                  width: 20,
                  height: 20
                },
                horizontalLines: [0, 10, 20],
                verticalLines: [0, 10, 20]
              }
            }
          ]
        }
      }}
    />
  );

  const panel = screen.getByLabelText("Digitiseringsdiagnostik");

  expect(panel).toHaveTextContent("Vertikal projektion: längd 8, max 7, medel 2.5, median 2, runs 6");
  expect(panel).toHaveTextContent("toppar pos 3 styrka 7; pos 1 styrka 6; pos 5 styrka 5; pos 0 styrka 4; pos 2 styrka 3 (visar 5 av 6)");
  expect(panel).toHaveTextContent("runs med täckning 3-4: max 7, medel 6, täckning max 70%, medel 60%; 1-1: max 6, medel 6, täckning max 60%, medel 60%; 5-5: max 5, medel 5, täckning max 50%, medel 50%; 0-0: max 4, medel 4, täckning max 40%, medel 40%; 2-2: max 3, medel 3, täckning max 30%, medel 30% (visar 5 av 6)");
  expect(panel).not.toHaveTextContent("Okänd diagnostik");
});

test("DigitizationDiagnosticPanel shows failure state", () => {
  const { container } = render(
    <DigitizationDiagnosticPanel
      digitizationResult={{
        status: "failed",
        error: new Error("reader failed")
      }}
    />
  );

  const panel = screen.getByLabelText("Digitiseringsdiagnostik");

  expect(panel).toHaveTextContent("Status: Bildanalysen misslyckades.");
  expect(panel).toHaveTextContent("Nästa steg: Fortsätt redigera manuellt eller prova att ladda upp bilden igen.");
  expect(container.querySelector("details")).not.toHaveAttribute("open");
  expect(panel).toHaveTextContent("Status: Analys misslyckades");
  expect(panel).toHaveTextContent("Förslag: Inga förslag");
  expect(panel).toHaveTextContent("Orsaker: reader failed");
});

test("DigitizationDiagnosticPanel shows actionable no-grid state", () => {
  const { container } = render(
    <DigitizationDiagnosticPanel
      digitizationResult={{
        status: "completed",
        result: {
          suggestions: [],
          gridDetection: {
            confidence: "missing-grid-geometry",
            geometry: null,
            diagnostics: [
              {
                type: "acceptance-status",
                accepted: false
              }
            ]
          }
        }
      }}
    />
  );

  const panel = screen.getByLabelText("Digitiseringsdiagnostik");

  expect(panel).toHaveTextContent("Status: Inget rutnät hittades.");
  expect(panel).toHaveTextContent("Nästa steg: Kontrollera bildens kontrast och beskärning, eller placera rutnätet manuellt.");
  expect(panel).toHaveTextContent("Grid avvisat");
  expect(container.querySelector("details")).not.toHaveAttribute("open");
});
