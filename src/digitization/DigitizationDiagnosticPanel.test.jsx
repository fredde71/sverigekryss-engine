import { readFileSync } from "fs";
import { fireEvent, render, screen } from "@testing-library/react";
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

test("DigitizationDiagnosticPanel formats vertical line mask comparison diagnostics readably", () => {
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
                  type: "vertical-line-mask-projection-comparison",
                  axis: "vertical",
                  preprocessing: {
                    maskType: "vertical-line",
                    retainedPixelRatio: 0.625,
                    retainedComponentCount: 3
                  },
                  raw: {
                    medianStrength: 2,
                    maxStrength: 9,
                    runCount: 6,
                    topPeaks: [
                      { position: 2, strength: 9 },
                      { position: 4, strength: 8 },
                      { position: 6, strength: 7 },
                      { position: 8, strength: 6 },
                      { position: 10, strength: 5 },
                      { position: 12, strength: 4 }
                    ],
                    topRuns: [
                      {
                        start: 2,
                        end: 2,
                        maxStrength: 9,
                        meanStrength: 9,
                        maxCoverage: 0.9,
                        meanCoverage: 0.9
                      },
                      {
                        start: 4,
                        end: 4,
                        maxStrength: 8,
                        meanStrength: 8,
                        maxCoverage: 0.8,
                        meanCoverage: 0.8
                      },
                      {
                        start: 6,
                        end: 6,
                        maxStrength: 7,
                        meanStrength: 7,
                        maxCoverage: 0.7,
                        meanCoverage: 0.7
                      },
                      {
                        start: 8,
                        end: 8,
                        maxStrength: 6,
                        meanStrength: 6,
                        maxCoverage: 0.6,
                        meanCoverage: 0.6
                      },
                      {
                        start: 10,
                        end: 10,
                        maxStrength: 5,
                        meanStrength: 5,
                        maxCoverage: 0.5,
                        meanCoverage: 0.5
                      },
                      {
                        start: 12,
                        end: 12,
                        maxStrength: 4,
                        meanStrength: 4,
                        maxCoverage: 0.4,
                        meanCoverage: 0.4
                      }
                    ]
                  },
                  mask: {
                    medianStrength: 1,
                    maxStrength: 7,
                    runCount: 2,
                    topPeaks: [
                      { position: 2, strength: 7 },
                      { position: 4, strength: 6 },
                      { position: 6, strength: 5 },
                      { position: 8, strength: 4 },
                      { position: 10, strength: 3 },
                      { position: 12, strength: 2 }
                    ],
                    topRuns: [
                      {
                        start: 2,
                        end: 4,
                        maxStrength: 7,
                        meanStrength: 6.5,
                        maxCoverage: 0.7,
                        meanCoverage: 0.65
                      },
                      {
                        start: 6,
                        end: 8,
                        maxStrength: 5,
                        meanStrength: 4.5,
                        maxCoverage: 0.5,
                        meanCoverage: 0.45
                      }
                    ]
                  }
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

  expect(screen.getByText("Utvecklardetaljer")).toBeInTheDocument();
  expect(panel).toHaveTextContent("Vertikal linjemask jämfört med rå projektion:");
  expect(panel).toHaveTextContent("rå median 2, mask median 1, rå max 9, mask max 7, rå runs 6, mask runs 2");
  expect(panel).toHaveTextContent("behållna pixlar 62.5%, behållna komponenter 3");
  expect(panel).toHaveTextContent("rå toppar pos 2 styrka 9; pos 4 styrka 8; pos 6 styrka 7; pos 8 styrka 6; pos 10 styrka 5 (visar 5 av 6)");
  expect(panel).toHaveTextContent("mask toppar pos 2 styrka 7; pos 4 styrka 6; pos 6 styrka 5; pos 8 styrka 4; pos 10 styrka 3 (visar 5 av 6)");
  expect(panel).toHaveTextContent("rå runs 2-2: max 9, medel 9, täckning max 90%, medel 90%; 4-4: max 8, medel 8, täckning max 80%, medel 80%; 6-6: max 7, medel 7, täckning max 70%, medel 70%; 8-8: max 6, medel 6, täckning max 60%, medel 60%; 10-10: max 5, medel 5, täckning max 50%, medel 50% (visar 5 av 6)");
  expect(panel).toHaveTextContent("mask runs 2-4: max 7, medel 6.5, täckning max 70%, medel 65%; 6-8: max 5, medel 4.5, täckning max 50%, medel 45%");
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

test("DigitizationDiagnosticPanel shows experimental results only inside developer details", () => {
  const { container } = render(
    <DigitizationDiagnosticPanel
      digitizationResult={{
        status: "completed",
        result: {
          suggestions: [],
          gridDetection: {
            confidence: "missing-grid-geometry",
            geometry: null,
            diagnostics: []
          }
        }
      }}
      experimentComparison={{
        status: "completed",
        result: {
          benchmark: {
            experiments: [
              {
                id: "vertical-continuity-diagnostics",
                description: "Local vertical continuity",
                durationMs: 1.25,
                success: true,
                diagnostics: {
                  type: "vertical-continuity-projection-comparison",
                  raw: {
                    maxStrength: 8
                  },
                  scores: {
                    maxStrength: 7.5
                  },
                  mask: {
                    maxStrength: 7
                  }
                }
              },
              {
                id: "failing-experiment",
                description: "Synthetic failure",
                durationMs: 0.5,
                success: false,
                diagnostics: {
                  type: "digitization-experiment-failure",
                  name: "Error",
                  message: "synthetic failure"
                }
              }
            ]
          }
        }
      }}
    />
  );

  const panel = screen.getByLabelText("Digitiseringsdiagnostik");
  const details = container.querySelector("details");
  const experimentalSection = screen.getByLabelText("Experimentell digitiseringsjämförelse");
  const userFacingText = Array.from(panel.children)
    .filter(element => element.tagName !== "DETAILS")
    .map(element => element.textContent)
    .join(" ");

  expect(details).not.toHaveAttribute("open");
  expect(details).toContainElement(experimentalSection);
  expect(userFacingText).not.toContain("vertical-continuity-diagnostics");
  expect(experimentalSection).toHaveTextContent("Experimentella resultat – endast utvecklardiagnostik");
  expect(experimentalSection).toHaveTextContent("ID: vertical-continuity-diagnostics");
  expect(experimentalSection).toHaveTextContent("Beskrivning: Local vertical continuity");
  expect(experimentalSection).toHaveTextContent("Status: Lyckades");
  expect(experimentalSection).toHaveTextContent("Tid: 1.25 ms");
  expect(experimentalSection).toHaveTextContent("vertical-continuity-projection-comparison, rå max 8, poäng max 7.5, mask max 7");
  expect(experimentalSection).toHaveTextContent("ID: failing-experiment");
  expect(experimentalSection).toHaveTextContent("Status: Misslyckades");
  expect(experimentalSection).toHaveTextContent("digitization-experiment-failure: Error: synthetic failure");
});

test("DigitizationDiagnosticPanel keeps production messaging when comparison fails", () => {
  const { container } = render(
    <DigitizationDiagnosticPanel
      digitizationResult={{
        status: "completed",
        result: {
          suggestions: [
            {
              confidence: "detected",
              grid: {
                rows: 2,
                cols: 2
              }
            }
          ]
        }
      }}
      experimentComparison={{
        status: "failed",
        error: new Error("benchmark unavailable")
      }}
    />
  );

  const panel = screen.getByLabelText("Digitiseringsdiagnostik");
  const experimentalSection = screen.getByLabelText("Experimentell digitiseringsjämförelse");

  expect(panel).toHaveTextContent("Status: Rutnät hittat.");
  expect(panel).toHaveTextContent("Nästa steg: Granska förhandsvisningen och justera manuellt vid behov.");
  expect(container.querySelector("details")).toContainElement(experimentalSection);
  expect(experimentalSection).toHaveTextContent("Experimentell jämförelse misslyckades: benchmark unavailable");
});

test("renders successful experiment visualizations only after developer details opens", () => {
  const { container } = renderExperimentComparison([
    createExperiment({
      id: "vertical-continuity-diagnostics",
      title: "Continuity projection"
    })
  ]);

  expect(screen.getByText("Diagnostik: comparison-diagnostics")).toBeInTheDocument();
  expect(screen.queryByRole("region", {
    name: "Experimentell visualisering: Continuity projection"
  })).not.toBeInTheDocument();

  openDeveloperDetails(container);

  const visualization = screen.getByRole("region", {
    name: "Experimentell visualisering: Continuity projection"
  });
  expect(container.querySelector("details")).toContainElement(visualization);
  expect(visualization).toHaveTextContent(
    "Experimentell visualisering – endast utvecklardiagnostik"
  );
  expect(screen.getByRole("region", { name: "Raw" })).toBeInTheDocument();
});

test("renders multiple experiment visualizations in benchmark registry order", () => {
  const { container } = renderExperimentComparison([
    createExperiment({ id: "first-experiment", title: "First projection" }),
    createExperiment({ id: "second-experiment", title: "Second projection" })
  ]);

  openDeveloperDetails(container);

  expect(screen.getAllByRole("region", {
    name: /Experimentell visualisering:/
  }).map((region) => region.getAttribute("aria-label"))).toEqual([
    "Experimentell visualisering: First projection",
    "Experimentell visualisering: Second projection"
  ]);
});

test("keeps successful experiments without visualizations readable", () => {
  const { container } = renderExperimentComparison([
    {
      id: "text-only-experiment",
      description: "Text-only diagnostics",
      durationMs: 2,
      success: true,
      diagnostics: {
        type: "text-only-diagnostics"
      }
    }
  ]);

  openDeveloperDetails(container);

  expect(screen.getByText("ID: text-only-experiment")).toBeInTheDocument();
  expect(screen.getByText("Diagnostik: text-only-diagnostics")).toBeInTheDocument();
  expect(screen.queryByRole("region", {
    name: /Experimentell visualisering:/
  })).not.toBeInTheDocument();
});

test("failed experiments retain failure diagnostics without rendering visualizations", () => {
  const { container } = renderExperimentComparison([
    {
      ...createExperiment({ id: "failed-experiment", title: "Must not render" }),
      success: false,
      diagnostics: {
        type: "digitization-experiment-failure",
        name: "Error",
        message: "failed",
        visualizations: [createVerticalProjectionVisualization("Must not render")]
      }
    }
  ]);

  openDeveloperDetails(container);

  expect(screen.getByText("Status: Misslyckades")).toBeInTheDocument();
  expect(screen.getByText(
    "Diagnostik: digitization-experiment-failure: Error: failed"
  )).toBeInTheDocument();
  expect(screen.queryByRole("region", {
    name: "Experimentell visualisering: Must not render"
  })).not.toBeInTheDocument();
});

test("visualization integration introduces no editor-state setters", () => {
  const source = readFileSync(
    `${__dirname}/DigitizationDiagnosticPanel.jsx`,
    "utf8"
  );

  expect(source).not.toMatch(
    /setGridArea|setRows|setCols|setCropArea|setSuggestions/
  );
});

function renderExperimentComparison(experiments) {
  return render(
    <DigitizationDiagnosticPanel
      digitizationResult={{
        status: "completed",
        result: {
          suggestions: [],
          gridDetection: {
            confidence: "missing-grid-geometry",
            diagnostics: []
          }
        }
      }}
      experimentComparison={{
        status: "completed",
        result: {
          benchmark: {
            experiments
          }
        }
      }}
    />
  );
}

function createExperiment({ id, title }) {
  return {
    id,
    description: `${id} description`,
    durationMs: 1,
    success: true,
    diagnostics: {
      type: "comparison-diagnostics",
      visualizations: [createVerticalProjectionVisualization(title)]
    }
  };
}

function createVerticalProjectionVisualization(title) {
  return {
    id: "vertical-projection",
    title,
    type: "vertical-projection",
    data: {
      axis: "vertical",
      axisLength: 10,
      length: 2,
      series: [
        {
          id: "raw",
          title: "Raw",
          values: [2, 10]
        }
      ]
    }
  };
}

function openDeveloperDetails(container) {
  const details = container.querySelector("details");
  details.open = true;
  fireEvent(details, new Event("toggle"));
}
