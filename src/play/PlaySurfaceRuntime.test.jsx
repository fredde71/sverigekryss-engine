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
        "write", "write", "write", "empty",
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
        "blocked", "empty", "empty", "empty",
        "write", "empty", "empty", "empty",
        "write", "empty", "empty", "empty"
      ])}
      onSubmitAnswers={() => {}}
    />
  );

  fireEvent.click(screen.getByTestId("runtime-clue-cell"));

  const inputs = screen.getAllByRole("textbox");

  await expectActiveInputs(inputs, [0, 1]);
});

test("single clue uses the same resolved start when an unrelated row is longer", async () => {
  render(
    <PlaySurface
      template={{
        ...createTemplate([]),
        rows: 4,
        cols: 5,
        cellTypes: [
          "write", "write", "write", "write", "write",
          "empty", "blocked", "empty", "empty", "empty",
          "empty", "write", "empty", "empty", "empty",
          "empty", "write", "empty", "empty", "empty"
        ]
      }}
      onSubmitAnswers={() => {}}
    />
  );

  fireEvent.click(screen.getByTestId("runtime-clue-cell"));

  await expectActiveInputs(screen.getAllByRole("textbox"), [5, 6]);
});

test("double clue toggles the light-blue answer highlight", async () => {
  render(
    <PlaySurface
      template={createTemplate([
        "double", "write", "write", "empty",
        "write", "empty", "empty", "empty",
        "write", "empty", "empty", "empty"
      ])}
      onSubmitAnswers={() => {}}
    />
  );

  const clue = screen.getByTestId("runtime-clue-cell");
  const inputs = screen.getAllByRole("textbox");

  fireEvent.click(clue);
  await expectActiveInputs(inputs, [2, 3]);

  fireEvent.click(clue);
  await expectActiveInputs(inputs, [0, 1]);
});

test("explicit turning path controls runtime highlighting", async () => {
  render(
    <PlaySurface
      template={{
        ...createTemplate([
          "blocked", "write", "write", "empty",
          "empty", "empty", "write", "empty",
          "empty", "write", "write", "empty"
        ]),
        answerPaths: [{
          clueIndex: 0,
          paths: [{
            direction: "across",
            cellIndexes: [1, 2, 6, 10, 9]
          }]
        }]
      }}
      onSubmitAnswers={() => {}}
    />
  );

  fireEvent.click(screen.getByTestId("runtime-clue-cell"));

  const inputs = screen.getAllByRole("textbox");
  await expectActiveInputs(inputs, [0, 1, 2, 4, 3]);
});

test("explicit double-clue paths toggle in runtime", async () => {
  render(
    <PlaySurface
      template={{
        ...createTemplate([
          "double", "write", "empty", "empty",
          "write", "write", "write", "empty",
          "write", "write", "empty", "empty"
        ]),
        answerPaths: [{
          clueIndex: 0,
          paths: [
            { direction: "across", cellIndexes: [1, 5, 6] },
            { direction: "down", cellIndexes: [4, 8, 9] }
          ]
        }]
      }}
      onSubmitAnswers={() => {}}
    />
  );

  const clue = screen.getByTestId("runtime-clue-cell");
  const inputs = screen.getAllByRole("textbox");

  fireEvent.click(clue);
  await expectActiveInputs(inputs, [1, 4, 5]);

  fireEvent.click(clue);
  await expectActiveInputs(inputs, [0, 2, 3]);
});

test("Play renders cells from the Template's persisted explicit grid geometry", () => {
  render(
    <PlaySurface
      template={{
        ...createTemplate(Array(4).fill("write")),
        rows: 2,
        cols: 2,
        cellTypes: Array(4).fill("write"),
        gridArea: {
          top: 10,
          left: 20,
          width: 100,
          height: 80
        },
        horizontalLinePositions: [10, 42, 90],
        verticalLinePositions: [20, 57, 120]
      }}
      onSubmitAnswers={() => {}}
    />
  );

  expect(screen.getByTestId("runtime-grid-explicit")).toBeInTheDocument();
  const cells = screen.getAllByRole("textbox").map(input => input.parentElement);
  expect(cells[0]).toHaveStyle({
    top: "0px",
    left: "0px",
    width: "37px",
    height: "32px"
  });
  expect(cells[3]).toHaveStyle({
    top: "32px",
    left: "37px",
    width: "63px",
    height: "48px"
  });
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
