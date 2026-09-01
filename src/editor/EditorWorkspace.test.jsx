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
  gridProposal = null
}) {
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [cellTypes, setCellTypes] = useState(initialCellTypes);
  const [competitionCells, setCompetitionCells] = useState(
    initialCompetitionCells
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
      <EditorWorkspace
        rows={rows}
        cols={cols}
        cellTypes={cellTypes}
        competitionCells={competitionCells}
        gridArea={currentGridArea}
        documentSize={documentSize}
        cropArea={currentCropArea}
        setRows={setRows}
        setCols={setCols}
        setGridArea={setGridArea}
        setCropArea={setCropArea}
        setCompetitionCells={setCompetitionCells}
        setCellTypes={setCellTypes}
        gridProposal={gridProposal}
        isPublicRuntime={false}
      >
        {({ toolbar, competitionMenu, editor }) => (
          <>
            {toolbar}
            {competitionMenu}
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

test("assigns a competition position to a writable cell", async () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
    />
  );

  await selectCompetitionTool();
  clickGridCell(0);
  fireEvent.click(await screen.findByRole("button", { name: "Position 1" }));

  expect(readCompetitionState()).toEqual([
    { index: 0, position: 1 }
  ]);
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
  fireEvent.click(await screen.findByRole("button", { name: "Ta bort" }));

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
  fireEvent.click(screen.getByRole("button", { name: "Blockerad" }));
  clickGridCell(0);

  expect(readCompetitionState()).toEqual([]);
});

test("does not show competition menu for non-writable cells", async () => {
  render(<EditorWorkspaceHarness />);

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
