import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  initialCompetitionCells = []
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
        isPublicRuntime={false}
      >
        {({ toolbar, competitionControl, editor }) => (
          <>
            {toolbar}
            {competitionControl}
            {editor}
          </>
        )}
      </EditorWorkspace>
    </>
  );
}

test("assigns a competition position to a writable cell", () => {
  render(<EditorWorkspaceHarness />);

  selectWriteTool();
  clickGridCell(0);
  fireEvent.change(screen.getByLabelText("Tävlingsruta"), {
    target: { value: "1" }
  });

  expect(readCompetitionState()).toEqual([
    { index: 0, position: 1 }
  ]);
});

test("moves an existing competition position to the newly selected cell", () => {
  render(<EditorWorkspaceHarness />);

  selectWriteTool();
  clickGridCell(0);
  fireEvent.change(screen.getByLabelText("Tävlingsruta"), {
    target: { value: "1" }
  });
  clickGridCell(3);
  fireEvent.change(screen.getByLabelText("Tävlingsruta"), {
    target: { value: "1" }
  });

  expect(readCompetitionState()).toEqual([
    { index: 3, position: 1 }
  ]);
});

test("clears a competition position from the selected cell", () => {
  render(<EditorWorkspaceHarness />);

  selectWriteTool();
  clickGridCell(0);
  fireEvent.change(screen.getByLabelText("Tävlingsruta"), {
    target: { value: "2" }
  });
  fireEvent.change(screen.getByLabelText("Tävlingsruta"), {
    target: { value: "" }
  });

  expect(readCompetitionState()).toEqual([]);
});

test("selects an existing writable cell without clearing it", () => {
  render(
    <EditorWorkspaceHarness
      initialCellTypes={["write", "empty", "empty", "empty"]}
    />
  );

  selectWriteTool();
  clickGridCell(0);

  expect(screen.getByLabelText("Tävlingsruta")).toBeInTheDocument();
});

test("removes competition metadata when a marked cell becomes non-writable", () => {
  render(<EditorWorkspaceHarness />);

  selectWriteTool();
  clickGridCell(0);
  fireEvent.change(screen.getByLabelText("Tävlingsruta"), {
    target: { value: "3" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Blocked" }));
  clickGridCell(0);

  expect(readCompetitionState()).toEqual([]);
});

test("does not show competition control for non-writable cells", () => {
  render(<EditorWorkspaceHarness />);

  clickGridCell(0);

  expect(screen.queryByLabelText("Tävlingsruta")).not.toBeInTheDocument();
  expect(readCompetitionState()).toEqual([]);
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
  fireEvent.click(screen.getByRole("button", { name: "Write" }));
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

function readCompetitionState() {
  return JSON.parse(screen.getByTestId("competition-state").textContent);
}
