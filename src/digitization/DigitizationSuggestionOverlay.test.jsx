import { render, screen } from "@testing-library/react";
import DigitizationSuggestionOverlay from "./DigitizationSuggestionOverlay";
import { detectGridFromImageSource } from "./detection/imageGridDetectionEngine";

const completedResult = {
  status: "completed",
  result: {
    suggestions: [
      {
        grid: {
          bounds: {
            top: 10,
            left: 20,
            width: 100,
            height: 80
          },
          horizontalLines: [10, 50, 90],
          verticalLines: [20, 70, 120],
          rows: 2,
          cols: 2
        }
      }
    ]
  }
};

test("DigitizationSuggestionOverlay appears for completed suggestions", () => {
  render(
    <DigitizationSuggestionOverlay
      digitizationResult={completedResult}
      documentSize={{
        width: 200,
        height: 160
      }}
    />
  );

  expect(screen.getByTestId("digitization-suggestion-overlay")).toHaveStyle({
    pointerEvents: "none",
    width: "200px",
    height: "160px"
  });
  expect(screen.getByTestId("digitization-suggestion-bounds")).toHaveAttribute("x", "20");
  expect(screen.getByTestId("digitization-suggestion-bounds")).toHaveAttribute("y", "10");
  expect(screen.getByTestId("digitization-suggestion-bounds")).toHaveAttribute("width", "100");
  expect(screen.getByTestId("digitization-suggestion-bounds")).toHaveAttribute("height", "80");
  expect(screen.getAllByTestId("digitization-suggestion-horizontal-line")).toHaveLength(3);
  expect(screen.getAllByTestId("digitization-suggestion-vertical-line")).toHaveLength(3);
});

test("DigitizationSuggestionOverlay disappears without a completed suggestion", () => {
  const { rerender } = render(
    <DigitizationSuggestionOverlay
      digitizationResult={null}
      documentSize={{
        width: 200,
        height: 160
      }}
    />
  );

  expect(screen.queryByTestId("digitization-suggestion-overlay")).toBeNull();

  rerender(
    <DigitizationSuggestionOverlay
      digitizationResult={{
        status: "pending"
      }}
      documentSize={{
        width: 200,
        height: 160
      }}
    />
  );

  expect(screen.queryByTestId("digitization-suggestion-overlay")).toBeNull();

  rerender(
    <DigitizationSuggestionOverlay
      digitizationResult={{
        status: "completed",
        result: {
          suggestions: []
        }
      }}
      documentSize={{
        width: 200,
        height: 160
      }}
    />
  );

  expect(screen.queryByTestId("digitization-suggestion-overlay")).toBeNull();
});

test("DigitizationSuggestionOverlay is non-interactive", () => {
  render(
    <DigitizationSuggestionOverlay
      digitizationResult={completedResult}
      documentSize={{
        width: 200,
        height: 160
      }}
    />
  );

  expect(screen.getByTestId("digitization-suggestion-overlay")).toHaveStyle({
    pointerEvents: "none"
  });
});

test("DigitizationSuggestionOverlay renders normalized upload geometry without scaling it", async () => {
  const documentSize = {
    width: 5,
    height: 20
  };
  const result = await detectGridFromImageSource({
    source: {
      id: "large-upload-source"
    },
    options: {
      documentSize
    },
    readImageData: jest.fn(async () => createRgbaImage({
      width: 10,
      height: 10,
      darkRows: [2, 4, 8],
      darkCols: [1, 5, 9]
    }))
  });

  render(
    <DigitizationSuggestionOverlay
      digitizationResult={{
        status: "completed",
        result
      }}
      documentSize={documentSize}
    />
  );

  expect(screen.getByTestId("digitization-suggestion-overlay")).toHaveAttribute("viewBox", "0 0 5 20");
  expect(screen.getByTestId("digitization-suggestion-bounds")).toHaveAttribute("x", "0.5");
  expect(screen.getByTestId("digitization-suggestion-bounds")).toHaveAttribute("y", "4");
  expect(screen.getByTestId("digitization-suggestion-bounds")).toHaveAttribute("width", "4");
  expect(screen.getByTestId("digitization-suggestion-bounds")).toHaveAttribute("height", "12");
  expect(screen.getAllByTestId("digitization-suggestion-horizontal-line").map(line => line.getAttribute("y1"))).toEqual(["4", "8", "16"]);
  expect(screen.getAllByTestId("digitization-suggestion-vertical-line").map(line => line.getAttribute("x1"))).toEqual(["0.5", "2.5", "4.5"]);
});

function createRgbaImage({
  width,
  height,
  darkRows = [],
  darkCols = []
}) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const isDark = darkRows.includes(y) || darkCols.includes(x);
      const value = isDark ? 0 : 255;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return {
    width,
    height,
    data
  };
}
