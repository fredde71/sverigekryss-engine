import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EditorWorkspace from "./EditorWorkspace";

const gridArea = {
  top: 0,
  left: 0,
  width: 400,
  height: 400
};

const documentSize = {
  width: 1200,
  height: 1200
};

const cropArea = {
  top: 0,
  left: 0,
  width: 1200,
  height: 1200
};

function EditorWorkspaceHarness({
  initialCellTypes = Array(4).fill("empty"),
  initialCompetitionCells = [],
  initialAnswerPaths = [],
  initialHorizontalLinePositions = null,
  initialVerticalLinePositions = null,
  gridProposal = null,
  documentLifecycleId = 0,
  documentAvailable = true
}) {
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [cellTypes, setCellTypes] = useState(initialCellTypes);
  const [competitionCells, setCompetitionCells] = useState(
    initialCompetitionCells
  );
  const [answerPaths, setAnswerPaths] = useState(initialAnswerPaths);
  const [horizontalLinePositions, setHorizontalLinePositions] = useState(
    initialHorizontalLinePositions
  );
  const [verticalLinePositions, setVerticalLinePositions] = useState(
    initialVerticalLinePositions
  );
  const [currentGridArea, setGridArea] = useState(gridArea);
  const [currentCropArea, setCropArea] = useState(cropArea);

  return (
    <>
      <div data-testid="competition-state">
        {JSON.stringify(competitionCells)}
      </div>
      <div data-testid="editor-grid-state">
        {JSON.stringify({
          rows,
          cols,
          gridArea: currentGridArea,
          cellTypes,
          competitionCells
        })}
      </div>
      <div data-testid="editor-crop-state">
        {JSON.stringify(currentCropArea)}
      </div>
      <div data-testid="answer-path-state">
        {JSON.stringify(answerPaths)}
      </div>
      <div data-testid="explicit-line-state">
        {JSON.stringify({ horizontalLinePositions, verticalLinePositions })}
      </div>
      <EditorWorkspace
        rows={rows}
        cols={cols}
        cellTypes={cellTypes}
        competitionCells={competitionCells}
        answerPaths={answerPaths}
        horizontalLinePositions={horizontalLinePositions}
        verticalLinePositions={verticalLinePositions}
        gridArea={currentGridArea}
        documentSize={documentSize}
        cropArea={currentCropArea}
        setRows={setRows}
        setCols={setCols}
        setGridArea={setGridArea}
        setCropArea={setCropArea}
        setCompetitionCells={setCompetitionCells}
        setAnswerPaths={setAnswerPaths}
        setHorizontalLinePositions={setHorizontalLinePositions}
        setVerticalLinePositions={setVerticalLinePositions}
        setCellTypes={setCellTypes}
        gridProposal={gridProposal}
        documentLifecycleId={documentLifecycleId}
        documentAvailable={documentAvailable}
        isPublicRuntime={false}
      >
        {({ toolbar, competitionMenu, answerPathMenu, editor }) => (
          <>
            {toolbar}
            {competitionMenu}
            {answerPathMenu}
            {editor}
          </>
        )}
      </EditorWorkspace>
    </>
  );
}

test("atomically applies a complete grid proposal through EditorWorkspace", async () => {
  const proposal = {
    rows: 3,
    cols: 2,
    gridArea: { top: 25, left: 30, width: 240, height: 360 },
    cellTypes: Array(6).fill("empty"),
    competitionCells: []
  };

  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "blocked", "empty", "empty"]}
      initialCompetitionCells={[{ index: 0, position: 1 }]}
      gridProposal={proposal}
    />
  );

  await waitFor(() => {
    expect(JSON.parse(screen.getByTestId("editor-grid-state").textContent))
      .toEqual(proposal);
  });
  expect(screen.queryAllByRole("button", { name: /Position/ })).toHaveLength(0);
});

test("owns and atomically renders optional reconstructed line positions", async () => {
  const proposal = deepFreeze({
    rows: 2,
    cols: 2,
    gridArea: { top: 10, left: 20, width: 120, height: 100 },
    horizontalLinePositions: [11.5, 60, 108.5],
    verticalLinePositions: [21.5, 80, 138.5],
    linePositionCoordinateSpace: "document",
    cellTypes: Array(4).fill("empty"),
    competitionCells: [],
    provenance: { source: "grid-lattice-editor-proposal" }
  });
  const before = JSON.stringify(proposal);

  render(<EditorWorkspaceHarness gridProposal={proposal} />);

  await waitFor(() => {
    expect(screen.getByTestId("editor-grid-explicit")).toBeInTheDocument();
  });
  expect(screen.getByTestId("editor-grid-line-horizontal-0"))
    .toHaveAttribute("data-line-position", "1.5");
  expect(screen.getByTestId("editor-grid-line-horizontal-2"))
    .toHaveAttribute("data-line-position", "98.5");
  expect(screen.getByTestId("editor-grid-line-vertical-0"))
    .toHaveAttribute("data-line-position", "1.5");
  expect(screen.getByTestId("editor-grid-line-vertical-2"))
    .toHaveAttribute("data-line-position", "118.5");
  expect(readExplicitLineState()).toEqual({
    horizontalLinePositions: proposal.horizontalLinePositions,
    verticalLinePositions: proposal.verticalLinePositions
  });
  expect(JSON.stringify(proposal)).toBe(before);

  fireEvent.click(screen.getByRole("button", { name: "Skapa rutnät" }));
  await waitFor(() => {
    expect(screen.getByTestId("editor-grid-uniform")).toBeInTheDocument();
  });
});

test("renders persisted template line positions without a new proposal", () => {
  render(
    <EditorWorkspaceHarness
      initialHorizontalLinePositions={[2, 47, 98]}
      initialVerticalLinePositions={[3, 49, 97]}
    />
  );

  expect(screen.getByTestId("editor-grid-explicit")).toBeInTheDocument();
  expect(screen.getByTestId("editor-grid-line-horizontal-1"))
    .toHaveAttribute("data-line-position", "47");
  expect(screen.getByTestId("editor-grid-line-vertical-1"))
    .toHaveAttribute("data-line-position", "49");
});

test("resets retained grid and explicit-line state when a new document begins", async () => {
  const firstProposal = {
    rows: 2,
    cols: 2,
    gridArea: { top: 10, left: 20, width: 120, height: 100 },
    horizontalLinePositions: [11.5, 60, 108.5],
    verticalLinePositions: [21.5, 80, 138.5],
    cellTypes: ["write", "blocked", "double", "empty"],
    competitionCells: [{ index: 0, position: 1 }]
  };
  const { rerender } = render(
    <EditorWorkspaceHarness
      gridProposal={firstProposal}
      documentLifecycleId={1}
    />
  );

  await waitFor(() => {
    expect(screen.getByTestId("editor-grid-explicit")).toBeInTheDocument();
  });

  rerender(
    <EditorWorkspaceHarness
      gridProposal={null}
      documentLifecycleId={2}
      documentAvailable={false}
    />
  );

  await waitFor(() => {
    const state = JSON.parse(
      screen.getByTestId("editor-grid-state").textContent
    );
    expect(state.rows).toBe(25);
    expect(state.cols).toBe(25);
    expect(state.gridArea).toEqual({
      top: 0,
      left: 0,
      width: 1200,
      height: 1200
    });
    expect(state.cellTypes).toEqual(Array(25 * 25).fill("empty"));
    expect(state.competitionCells).toEqual([]);
    expect(JSON.parse(screen.getByTestId("editor-crop-state").textContent))
      .toEqual({ top: 0, left: 0, width: 1200, height: 1200 });
    expect(screen.queryByTestId("editor-grid-explicit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("editor-grid-uniform")).not.toBeInTheDocument();
  });
});

test("atomically applies the new document proposal after lifecycle reset", async () => {
  const firstProposal = {
    rows: 2,
    cols: 2,
    gridArea: { top: 10, left: 20, width: 120, height: 100 },
    horizontalLinePositions: [11.5, 60, 108.5],
    verticalLinePositions: [21.5, 80, 138.5],
    cellTypes: Array(4).fill("empty"),
    competitionCells: []
  };
  const secondProposal = {
    rows: 3,
    cols: 2,
    gridArea: { top: 30, left: 40, width: 180, height: 240 },
    horizontalLinePositions: [31, 110, 190, 269],
    verticalLinePositions: [41, 130, 219],
    cellTypes: Array(6).fill("empty"),
    competitionCells: []
  };
  const { rerender } = render(
    <EditorWorkspaceHarness
      gridProposal={firstProposal}
      documentLifecycleId={1}
    />
  );

  await waitFor(() => {
    expect(screen.getByTestId("editor-grid-explicit")).toBeInTheDocument();
  });

  rerender(
    <EditorWorkspaceHarness
      gridProposal={null}
      documentLifecycleId={2}
      documentAvailable={false}
    />
  );
  await waitFor(() => {
    expect(screen.queryByTestId("editor-grid-explicit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("editor-grid-uniform")).not.toBeInTheDocument();
  });

  rerender(
    <EditorWorkspaceHarness
      gridProposal={secondProposal}
      documentLifecycleId={2}
      documentAvailable={true}
    />
  );

  await waitFor(() => {
    expect(JSON.parse(screen.getByTestId("editor-grid-state").textContent))
      .toEqual({
        rows: secondProposal.rows,
        cols: secondProposal.cols,
        gridArea: secondProposal.gridArea,
        cellTypes: secondProposal.cellTypes,
        competitionCells: secondProposal.competitionCells
      });
    expect(screen.getByTestId("editor-grid-explicit")).toBeInTheDocument();
  });
});

test("renders no crossword grid before a document is available", () => {
  render(
    <EditorWorkspaceHarness
      documentLifecycleId={0}
      documentAvailable={false}
    />
  );

  expect(screen.queryByTestId("editor-grid-explicit")).not.toBeInTheDocument();
  expect(screen.queryByTestId("editor-grid-uniform")).not.toBeInTheDocument();
});

test("assigns a competition position to a writable cell", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
    />
  );

  await selectCompetitionTool();
  clickGridCell(0);
  expect(await screen.findByTestId("competition-cell-menu"))
    .toHaveAccessibleName("Tävlingsposition för cell 1");
  expect(screen.getByTestId("competition-cell-assignment-status"))
    .toHaveTextContent("Ingen position tilldelad");
  expect(screen.getByRole("button", { name: "Ta bort tilldelning" }))
    .toBeDisabled();
  fireEvent.click(await screen.findByRole("button", { name: "Position 1" }));

  expect(readCompetitionState()).toEqual([
    { index: 0, position: 1 }
  ]);
  expect(screen.getByLabelText("Tävlingsposition 1")).toHaveTextContent("1");
});

test("turns an empty cell into write and immediately opens competition position choices", async () => {
  render(<EditorWorkspaceHarness />);

  await selectCompetitionTool();
  clickGridCell(0);

  await waitFor(() => {
    expect(JSON.parse(
      screen.getByTestId("editor-grid-state").textContent
    ).cellTypes[0]).toBe("write");
  });
  expect(screen.getByTestId("competition-cell-menu")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Position 1" })).toBeInTheDocument();
  expect(readCompetitionState()).toEqual([]);

  fireEvent.click(screen.getByRole("button", { name: "Position 3" }));
  expect(readCompetitionState()).toEqual([{ index: 0, position: 3 }]);
});

test("removing competition status leaves an automatically converted cell writable", async () => {
  render(<EditorWorkspaceHarness />);

  await selectCompetitionTool();
  clickGridCell(0);
  fireEvent.click(await screen.findByRole("button", { name: "Position 4" }));
  clickGridCell(0);
  fireEvent.click(await screen.findByRole("button", {
    name: "Ta bort tilldelning"
  }));

  expect(readCompetitionState()).toEqual([]);
  expect(JSON.parse(screen.getByTestId("editor-grid-state").textContent)
    .cellTypes[0]).toBe("write");
});

test("moves an existing competition position to the newly selected cell", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "write"]}
    />
  );

  await selectCompetitionTool();
  clickGridCell(0);
  fireEvent.click(await screen.findByRole("button", { name: "Position 1" }));
  clickGridCell(3);
  fireEvent.click(await screen.findByRole("button", { name: "Position 1" }));

  expect(readCompetitionState()).toEqual([
    { index: 3, position: 1 }
  ]);
});

test("clears a competition position from the selected cell", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
      initialCompetitionCells={[{ index: 0, position: 2 }]}
    />
  );

  await selectCompetitionTool();
  clickGridCell(0);
  expect(screen.getByTestId("competition-cell-assignment-status"))
    .toHaveTextContent("Nuvarande position: 2");
  expect(screen.getByRole("button", { name: "Position 2" }))
    .toHaveAttribute("aria-pressed", "true");
  fireEvent.click(await screen.findByRole("button", {
    name: "Ta bort tilldelning"
  }));

  expect(readCompetitionState()).toEqual([]);
});

test("shows competition menu for an existing writable cell", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
    />
  );

  await selectCompetitionTool();
  clickGridCell(0);

  expect(await screen.findByTestId("competition-cell-menu")).toBeInTheDocument();
});

test("changes an existing competition-cell position and updates its marker", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
      initialCompetitionCells={[{ index: 0, position: 2 }]}
    />
  );

  await selectCompetitionTool();
  clickGridCell(0);

  expect(await screen.findByTestId("competition-cell-assignment-status"))
    .toHaveTextContent("Nuvarande position: 2");
  fireEvent.click(screen.getByRole("button", { name: "Position 5" }));

  expect(readCompetitionState()).toEqual([{ index: 0, position: 5 }]);
  expect(screen.getByLabelText("Tävlingsposition 5")).toHaveTextContent("5");
});

test("opens competition menu when the writable cell click lands on the top-edge handle", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
    />
  );

  await selectCompetitionTool();
  clickTopEdgeCell(0);

  expect(await screen.findByTestId("competition-cell-menu")).toBeInTheDocument();
});

test("competition tool lets cell clicks pass through editor affordances", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
    />
  );

  expect(screen.getByTestId("editor-crop-move-affordance")).toHaveStyle({
    pointerEvents: "auto"
  });
  expect(screen.getByTestId("editor-grid-move-affordance")).toHaveStyle({
    pointerEvents: "auto"
  });

  await selectCompetitionTool();

  expect(screen.getByTestId("editor-crop-move-affordance")).toHaveStyle({
    pointerEvents: "none"
  });
  expect(screen.getByTestId("editor-crop-resize-handle")).toHaveStyle({
    pointerEvents: "none"
  });
  expect(screen.getByTestId("editor-grid-move-affordance")).toHaveStyle({
    pointerEvents: "none"
  });
  expect(screen.getByTestId("editor-grid-resize-handle")).toHaveStyle({
    pointerEvents: "none"
  });
});

test("removes competition metadata when a marked cell becomes non-writable", async () => {
  render(<EditorWorkspaceHarness />);

  selectWriteTool();
  clickGridCell(0);
  await selectCompetitionTool();
  clickGridCell(0);
  fireEvent.click(await screen.findByRole("button", { name: "Position 3" }));
  fireEvent.click(screen.getByRole("button", { name: "Enkelledtråd" }));
  clickGridCell(0);

  expect(readCompetitionState()).toEqual([]);
});

test("uses clue terminology for the existing blocked and double editor tools", () => {
  render(<EditorWorkspaceHarness />);

  expect(screen.getByRole("button", { name: "Enkelledtråd" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Dubbelledtråd" })).toBeInTheDocument();
});

test("authors and visually orders one turning path for a single clue", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["blocked", "write", "write", "write"]}
    />
  );

  selectAnswerPathTool();
  clickGridCell(0);
  fireEvent.click(screen.getByRole("button", {
    name: "Välj vågrät svarsväg"
  }));
  expect(screen.getByRole("button", { name: "Välj vågrät svarsväg" }))
    .toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTestId("active-answer-path-status"))
    .toHaveTextContent("Aktiv svarsväg: vågrät");
  clickGridCell(1);
  clickGridCell(3);

  expect(screen.getByTestId("editor-grid-cell-1")).toHaveStyle({
    backgroundColor: "rgba(147, 51, 234, 0.42)"
  });
  expect(screen.getByTestId("editor-grid-cell-2")).toHaveStyle({
    backgroundColor: "rgba(0,255,0,0.25)"
  });
  clickGridCell(2);

  expect(screen.getByTestId("editor-answer-path-position-1")).toHaveTextContent("1");
  expect(screen.getByTestId("editor-answer-path-position-2")).toHaveTextContent("2");
  expect(screen.getByTestId("editor-answer-path-position-3")).toHaveTextContent("3");
  fireEvent.click(screen.getByRole("button", { name: "Spara svarsväg" }));

  expect(readAnswerPathState()).toEqual([{
    clueIndex: 0,
    paths: [{ direction: "across", cellIndexes: [1, 3, 2] }]
  }]);
  expect(JSON.parse(screen.getByTestId("editor-grid-state").textContent).cellTypes)
    .toEqual(["blocked", "write", "write", "write"]);
  expect(screen.getByRole("button", { name: "Välj lodrät svarsväg" }))
    .toBeDisabled();
});

test("authors two separate paths for a double clue", () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["double", "write", "write", "write"]}
    />
  );

  selectAnswerPathTool();
  clickGridCell(0);
  fireEvent.click(screen.getByRole("button", {
    name: "Skapa svarsväg 1 (vågrät)"
  }));
  clickGridCell(1);
  clickGridCell(3);
  fireEvent.click(screen.getByRole("button", { name: "Spara svarsväg" }));

  fireEvent.click(screen.getByRole("button", {
    name: "Skapa svarsväg 2 (lodrät)"
  }));
  expect(screen.getByRole("button", { name: "Skapa svarsväg 2 (lodrät)" }))
    .toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Redigera svarsväg 1 (vågrät)" }))
    .toHaveAttribute("aria-pressed", "false");
  clickGridCell(2);
  clickGridCell(3);
  fireEvent.click(screen.getByRole("button", { name: "Spara svarsväg" }));

  expect(readAnswerPathState()).toEqual([{
    clueIndex: 0,
    paths: [
      { direction: "across", cellIndexes: [1, 3] },
      { direction: "down", cellIndexes: [2, 3] }
    ]
  }]);
  expect(screen.getByTestId("answer-path-slot-1"))
    .toHaveTextContent("Svarsväg 1: sparad");
  expect(screen.getByTestId("answer-path-slot-2"))
    .toHaveTextContent("Svarsväg 2: sparad");

  fireEvent.click(screen.getByRole("button", {
    name: "Redigera svarsväg 1 (vågrät)"
  }));
  fireEvent.click(screen.getByRole("button", {
    name: "Börja om med aktiv svarsväg"
  }));
  clickGridCell(3);
  clickGridCell(1);
  fireEvent.click(screen.getByRole("button", { name: "Spara svarsväg" }));

  expect(readAnswerPathState()).toEqual([{
    clueIndex: 0,
    paths: [
      { direction: "across", cellIndexes: [3, 1] },
      { direction: "down", cellIndexes: [2, 3] }
    ]
  }]);

  fireEvent.click(screen.getByRole("button", {
    name: "Redigera svarsväg 2 (lodrät)"
  }));
  fireEvent.click(screen.getByRole("button", {
    name: "Börja om med aktiv svarsväg"
  }));
  clickGridCell(1);
  clickGridCell(2);
  fireEvent.click(screen.getByRole("button", { name: "Spara svarsväg" }));

  expect(readAnswerPathState()).toEqual([{
    clueIndex: 0,
    paths: [
      { direction: "across", cellIndexes: [3, 1] },
      { direction: "down", cellIndexes: [1, 2] }
    ]
  }]);
});

test("clears and redefines an existing answer path", () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["blocked", "write", "write", "write"]}
      initialAnswerPaths={[{
        clueIndex: 0,
        paths: [{ direction: "across", cellIndexes: [1, 3] }]
      }]}
    />
  );

  selectAnswerPathTool();
  clickGridCell(0);
  fireEvent.click(screen.getByRole("button", {
    name: "Välj vågrät svarsväg"
  }));
  expect(screen.getByTestId("editor-answer-path-position-1")).toHaveTextContent("1");
  expect(screen.getByTestId("editor-answer-path-position-2")).toHaveTextContent("2");
  fireEvent.click(screen.getByRole("button", {
    name: "Börja om med aktiv svarsväg"
  }));
  clickGridCell(2);
  fireEvent.click(screen.getByRole("button", { name: "Spara svarsväg" }));

  expect(readAnswerPathState()[0].paths[0].cellIndexes).toEqual([2]);

  fireEvent.click(screen.getByRole("button", {
    name: "Rensa vågrät svarsväg"
  }));
  expect(readAnswerPathState()).toEqual([]);
});

test("answer-path mode ignores non-clue selection and preserves normal cell tools", () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
    />
  );

  selectAnswerPathTool();
  clickGridCell(0);
  expect(screen.queryByTestId("answer-path-menu")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Enkelledtråd" }));
  clickGridCell(0);
  expect(JSON.parse(screen.getByTestId("editor-grid-state").textContent).cellTypes[0])
    .toBe("blocked");
});

test("does not show competition menu for clue cells", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["blocked", "empty", "empty", "empty"]}
    />
  );

  await selectCompetitionTool();
  clickGridCell(0);

  expect(screen.queryByTestId("competition-cell-menu")).not.toBeInTheDocument();
  expect(readCompetitionState()).toEqual([]);
});

test("selecting another tool exits competition mode", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
    />
  );

  await selectCompetitionTool();
  clickGridCell(0);
  expect(await screen.findByTestId("competition-cell-menu")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Bild" }));

  expect(screen.queryByTestId("competition-cell-menu")).not.toBeInTheDocument();
});

test("renders editor-only badge for assigned competition position", () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
      initialCompetitionCells={[{ index: 0, position: 4 }]}
    />
  );

  expect(screen.getByTestId("editor-competition-badge-0")).toHaveTextContent(
    "4"
  );
});

function selectWriteTool() {
  fireEvent.click(screen.getByRole("button", { name: "Skrivruta" }));
}

function selectAnswerPathTool() {
  fireEvent.click(screen.getByRole("button", { name: "Svarsvägar" }));
}

function readAnswerPathState() {
  return JSON.parse(screen.getByTestId("answer-path-state").textContent);
}

function readExplicitLineState() {
  return JSON.parse(screen.getByTestId("explicit-line-state").textContent);
}

async function selectCompetitionTool() {
  const button = screen.getByRole("button", { name: "🏆 Tävlingsruta" });

  fireEvent.click(button);

  await waitFor(() => {
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
}

function clickGridCell(index) {
  const gridFrame = screen.getByTestId("editor-grid-frame");

  gridFrame.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    width: 400,
    height: 400
  });

  const coordinatesByIndex = [
    { clientX: 50, clientY: 50 },
    { clientX: 250, clientY: 50 },
    { clientX: 50, clientY: 250 },
    { clientX: 250, clientY: 250 }
  ];

  fireEvent.click(gridFrame, coordinatesByIndex[index]);
}

function clickTopEdgeCell(index) {
  const gridFrame = screen.getByTestId("editor-grid-frame");
  const topEdge = screen.getByTestId("editor-grid-move-affordance");

  gridFrame.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    width: 400,
    height: 400
  });

  const coordinatesByIndex = [
    { clientX: 50, clientY: 10 },
    { clientX: 250, clientY: 10 }
  ];

  fireEvent.mouseDown(topEdge, coordinatesByIndex[index]);
  fireEvent.mouseUp(window);
  fireEvent.click(topEdge, coordinatesByIndex[index]);
}

function readCompetitionState() {
  return JSON.parse(screen.getByTestId("competition-state").textContent);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
