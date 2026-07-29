import { render, screen } from "@testing-library/react";
import DigitizationDiagnosticPanel from "./DigitizationDiagnosticPanel";

test("DigitizationDiagnosticPanel shows no-result state", () => {
  render(<DigitizationDiagnosticPanel digitizationResult={null} />);

  expect(screen.getByLabelText("Digitiseringsdiagnostik")).toHaveTextContent("Status: Ingen analys körd");
  expect(screen.getByLabelText("Digitiseringsdiagnostik")).toHaveTextContent("Förslag: Inga förslag");
  expect(screen.getByLabelText("Digitiseringsdiagnostik")).toHaveTextContent("Konfidens: Saknas");
});

test("DigitizationDiagnosticPanel shows successful suggestion diagnostics defensively", () => {
  render(
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

  expect(panel).toHaveTextContent("Status: Analys klar");
  expect(panel).toHaveTextContent("Förslag: Förslag finns");
  expect(panel).toHaveTextContent("Konfidens: detected");
  expect(panel).toHaveTextContent("Orsaker: line candidates accepted");
  expect(panel).toHaveTextContent("Mått: horisontella linjer 3, vertikala linjer 4");
  expect(panel).toHaveTextContent("Rader/kolumner: 2 x 3");
  expect(panel).toHaveTextContent("Geometri: top 1, left 2, width 30, height 20");
});

test("DigitizationDiagnosticPanel shows failure state", () => {
  render(
    <DigitizationDiagnosticPanel
      digitizationResult={{
        status: "failed",
        error: new Error("reader failed")
      }}
    />
  );

  const panel = screen.getByLabelText("Digitiseringsdiagnostik");

  expect(panel).toHaveTextContent("Status: Analys misslyckades");
  expect(panel).toHaveTextContent("Förslag: Inga förslag");
  expect(panel).toHaveTextContent("Orsaker: reader failed");
});
