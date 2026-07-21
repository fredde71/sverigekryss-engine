import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PlaySurface from "./PlaySurface";

function createTemplate(cellTypes) {
  return {
    crosswordId: "TT-2026-0001",
    rows: 3,
    cols: 4,
    cellTypes,
    imageSrc: "/grid.png",
    documentSize: {
      width: 1200,
      height: 1200
    },
    cropArea: {
      top: 0,
      left: 0,
      width: 1200,
      height: 1200
    },
    gridArea: {
      top: 0,
      left: 0,
      width: 400,
      height: 300
    }
  };
}

test("clicking a blocked horizontal clue activates the full adjacent across word", async () => {
  render(
    <PlaySurface
      template={createTemplate([
        "blocked", "write", "write", "write",
        "write", "empty", "empty", "empty",
        "empty", "empty", "empty", "empty"
      ])}
      onSubmitAnswers={() => {}}
    />
  );

  fireEvent.click(screen.getByTestId("runtime-clue-cell"));

  const inputs = screen.getAllByRole("textbox");

  await expectActiveInputs(inputs, [0, 1, 2]);
});

test("clicking a blocked vertical clue activates the full adjacent down word", async () => {
  render(
    <PlaySurface
      template={createTemplate([
        "blocked", "write", "empty", "empty",
        "write", "empty", "empty", "empty",
        "write", "empty", "empty", "empty"
      ])}
      onSubmitAnswers={() => {}}
    />
  );

  fireEvent.click(screen.getByTestId("runtime-clue-cell"));

  const inputs = screen.getAllByRole("textbox");

  await expectActiveInputs(inputs, [1, 2]);
});

async function expectActiveInputs(inputs, activeIndexes) {
  await waitFor(() => {
    expect(inputs[activeIndexes[0]].parentElement).toHaveStyle({
      backgroundColor: "rgba(0, 120, 255, 0.2)"
    });
  });

  inputs.forEach((input, index) => {
    if (activeIndexes.includes(index)) {
      expect(input.parentElement).toHaveStyle({
        backgroundColor: "rgba(0, 120, 255, 0.2)"
      });
    } else {
      expect(input.parentElement).not.toHaveStyle({
        backgroundColor: "rgba(0, 120, 255, 0.2)"
      });
    }
  });
}
