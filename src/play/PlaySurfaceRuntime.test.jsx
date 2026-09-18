import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PlaySurface from "./PlaySurface";
import { createMusikkryssTemplate } from "../musikkryss/MusikkryssTemplateInitializer";
import {
  createMusikkryssReferenceContent
} from "../musikkryss/MusikkryssReferenceContentPack";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
  };
});

afterAll(() => {
  delete global.ResizeObserver;
});

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

test("Musikkryss lists directional answers and activates the complete path", async () => {
  const base = createMusikkryssTemplate({
    crosswordId: "MUSIK-2026-38",
    documentSize: { width: 490, height: 540 },
    imageSrc: "/music-grid.png"
  });
  const onActiveSpokenContentSourceChange = jest.fn();
  render(
    <PlaySurface
      template={{
        ...base,
        musikkryss: createMusikkryssReferenceContent()
      }}
      onSubmitAnswers={() => {}}
      onActiveSpokenContentSourceChange={onActiveSpokenContentSourceChange}
    />
  );

  expect(screen.getByRole("region", { name: "Musikkryss-svar" }))
    .toBeInTheDocument();
  expect(screen.getByRole("button", { name: "1 vågrätt" }))
    .toBeInTheDocument();
  expect(screen.getByRole("button", { name: "1 lodrätt" }))
    .toBeInTheDocument();
  expect(screen.getByTestId("runtime-grid-explicit")).toBeInTheDocument();
  expect(screen.getByTestId("musikkryss-play-crossword")).toHaveStyle({
    flex: "0 0 650px",
    width: "100%",
    maxWidth: "650px"
  });
  expect(screen.getByTestId("template-canvas-responsive-wrapper"))
    .toBeInTheDocument();
  expect(screen.getByTestId("runtime-cell-label-1")).toHaveTextContent("1");
  expect(screen.getByTestId("runtime-cell-label-13")).toHaveTextContent("13");

  fireEvent.click(screen.getByRole("button", { name: "1 lodrätt" }));

  await expectActiveCellIndexes([0, 10, 20, 30, 40, 50, 60, 70]);
  expect(screen.getByRole("button", { name: "1 lodrätt" }))
    .toHaveAttribute("aria-pressed", "true");
  expect(getInputAt(0).parentElement).toHaveAttribute(
    "data-path-state",
    "focused"
  );
  expect(getInputAt(10).parentElement).toHaveAttribute(
    "data-path-state",
    "selected"
  );
  expect(getInputAt(1).parentElement).toHaveAttribute(
    "data-path-state",
    "dimmed"
  );
  expect(getInputAt(0).parentElement).toHaveStyle({
    backgroundColor: "rgba(37, 99, 235, 0.58)"
  });
  expect(getInputAt(10).parentElement).toHaveStyle({
    backgroundColor: "rgba(125, 211, 252, 0.52)"
  });
  expect(getInputAt(1).parentElement).toHaveStyle({
    backgroundColor: "rgba(148, 163, 184, 0.38)"
  });
  expect(document.querySelector(
    '[data-testid="runtime-black-cell"][data-index="8"]'
  )).toHaveStyle({
    backgroundColor: "rgb(0, 0, 0)"
  });
  expect(getInputAt(0)).toHaveStyle({
    fontSize: "30px",
    textAlign: "center",
    lineHeight: "1"
  });
  await waitFor(() => expect(document.activeElement).toHaveAttribute(
    "data-index",
    "0"
  ));
  await waitFor(() => expect(onActiveSpokenContentSourceChange)
    .toHaveBeenLastCalledWith(expect.objectContaining({
      type: "musikkryss-spoken-content-source",
      answerId: "1:down",
      contentSequence: [expect.objectContaining({
        type: "text",
        text: expect.stringContaining("Deep Purple")
      })]
    })));
});

test("Musikkryss typing follows path order and crossing answers share letters", async () => {
  render(
    <PlaySurface
      template={createMusikkryssTemplate({
        crosswordId: "MUSIK-2026-38",
        documentSize: { width: 490, height: 540 },
        imageSrc: "/music-grid.png"
      })}
      onSubmitAnswers={() => {}}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "1 lodrätt" }));
  const crossingInput = getInputAt(0);
  fireEvent.change(crossingInput, { target: { value: "A" } });

  await waitFor(() => expect(document.activeElement).toHaveAttribute(
    "data-index",
    "10"
  ));
  fireEvent.change(getInputAt(10), { target: { value: "B" } });
  await waitFor(() => expect(document.activeElement).toHaveAttribute(
    "data-index",
    "20"
  ));

  fireEvent.click(screen.getByRole("button", { name: "1 vågrätt" }));
  await expectActiveCellIndexes([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(getInputAt(0)).toHaveValue("A");
  expect(getInputAt(10)).toHaveValue("B");
});

test("solve mode exposes no solution controls", () => {
  render(
    <PlaySurface
      template={{
        ...createTemplate(["blocked", "write", "write", "write"]),
        answerPaths: [{
          clueIndex: 0,
          paths: [{
            direction: "across",
            cellIndexes: [1, 2, 3],
            solution: "ABC"
          }]
        }]
      }}
      onSubmitAnswers={() => {}}
    />
  );

  expect(screen.queryByRole("region", { name: "Facit och hjälp" }))
    .not.toBeInTheDocument();
});

test("Sverigekryss help reveals selected letters and answer without mutating other input", async () => {
  const helpTemplate = {
    ...createTemplate([
      "blocked", "write", "write", "write",
      "write", "write", "write", "empty",
      "empty", "empty", "empty", "empty"
    ]),
    answerPaths: [{
      clueIndex: 0,
      paths: [{
        direction: "across",
        cellIndexes: [1, 2, 3],
        solution: "ABC"
      }]
    }]
  };

  render(
    <PlaySurface
      template={helpTemplate}
      publicationAccess={{ capabilities: { useCanonicalSolutions: true } }}
      onSubmitAnswers={() => {}}
    />
  );

  fireEvent.change(getInputAt(5), { target: { value: "X" } });
  fireEvent.click(screen.getByTestId("runtime-clue-cell"));
  fireEvent.click(screen.getByRole("button", { name: "Visa en bokstav" }));

  await waitFor(() => expect(getInputAt(1)).toHaveValue("A"));
  expect(getInputAt(1)).toHaveAttribute("readonly");
  expect(getInputAt(5)).toHaveValue("X");

  fireEvent.change(getInputAt(2), { target: { value: "Z" } });
  fireEvent.click(screen.getByRole("button", { name: "Visa svaret" }));
  await waitFor(() => {
    expect(getInputAt(1)).toHaveValue("A");
    expect(getInputAt(2)).toHaveValue("B");
    expect(getInputAt(3)).toHaveValue("C");
  });
  expect(helpTemplate.answerPaths[0].paths[0].solution).toBe("ABC");
});

test("Musikkryss help reveals selected directional answer and full solution", async () => {
  const base = createMusikkryssTemplate({
    crosswordId: "MUSIK-HELP-1",
    documentSize: { width: 490, height: 540 },
    imageSrc: "/music-grid.png"
  });
  const template = {
    ...base,
    musikkryss: {
      ...base.musikkryss,
      answers: base.musikkryss.answers.map(answer => ({
        ...answer,
        solution: "A".repeat(answer.answerPath.length)
      }))
    }
  };

  render(
    <PlaySurface
      template={template}
      publicationAccess={{ capabilities: { useCanonicalSolutions: true } }}
      onSubmitAnswers={() => {}}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "1 lodrätt" }));
  fireEvent.click(screen.getByRole("button", { name: "Visa svaret" }));
  await waitFor(() => {
    [0, 10, 20, 30, 40, 50, 60, 70].forEach(index => {
      expect(getInputAt(index)).toHaveValue("A");
    });
  });

  fireEvent.click(screen.getByRole("button", { name: "Visa hela facit" }));
  await waitFor(() => {
    expect(getInputAt(1)).toHaveValue("A");
    expect(getInputAt(86)).toHaveValue("A");
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

async function expectActiveCellIndexes(activeIndexes) {
  await waitFor(() => {
    activeIndexes.forEach(index => {
      expect(getInputAt(index).parentElement.getAttribute("data-path-state"))
        .toMatch(/^(focused|selected)$/);
    });
  });
}

function getInputAt(index) {
  return document.querySelector(`input[data-index="${index}"]`);
}
