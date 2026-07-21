import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PlaySurface from "./PlaySurface";

const template = {
  crosswordId: "TT-2026-0001",
  rows: 2,
  cols: 3,
  cellTypes: [
    "blocked", "write", "write",
    "blocked", "write", "write"
  ],
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
    width: 300,
    height: 200
  }
};

test("clicking a blocked simple clue cell activates the adjacent write word", async () => {
  render(<PlaySurface template={template} onSubmitAnswers={() => {}} />);

  fireEvent.click(screen.getAllByTestId("runtime-clue-cell")[0]);

  const inputs = screen.getAllByRole("textbox");

  await waitFor(() => {
    expect(inputs[0].parentElement).toHaveStyle({
      backgroundColor: "rgba(0, 120, 255, 0.2)"
    });
  });
  expect(inputs[1].parentElement).toHaveStyle({
    backgroundColor: "rgba(0, 120, 255, 0.2)"
  });
  expect(inputs[2].parentElement).not.toHaveStyle({
    backgroundColor: "rgba(0, 120, 255, 0.2)"
  });
});
