import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import EditorViewport from "./EditorViewport";

const initialGridArea = {
  top: 20,
  left: 30,
  width: 400,
  height: 300
};

const initialCropArea = {
  top: 100,
  left: 80,
  width: 900,
  height: 700
};

const defaultDocumentSize = {
  width: 1200,
  height: 1200
};

function EditorViewportHarness({
  cropArea = initialCropArea,
  gridArea = initialGridArea,
  documentSize = defaultDocumentSize
}) {
  const [currentCropArea, setCropArea] = useState(cropArea);
  const [currentGridArea, setGridArea] = useState(gridArea);
  const [cropMode, setCropMode] = useState(null);

  return (
    <>
      <div data-testid="crop-state">
        {JSON.stringify(currentCropArea)}
      </div>
      <div data-testid="grid-state">
        {JSON.stringify(currentGridArea)}
      </div>
      <EditorViewport
        gridArea={currentGridArea}
        documentSize={documentSize}
        setGridArea={setGridArea}
        setCropArea={setCropArea}
        cropMode={cropMode}
        setCropMode={setCropMode}
        rows={2}
        cols={2}
        activeTool="write"
        setCellTypes={() => {}}
      >
        {({ startGridMove, startGridResize, setCropMode }) => (
          <>
            <button
              data-testid="start-crop-move"
              onMouseDown={() => setCropMode("move")}
            />
            <button
              data-testid="start-crop-resize"
              onMouseDown={() => setCropMode("resize")}
            />
            <button
              data-testid="start-grid-move"
              onMouseDown={startGridMove}
            />
            <button
              data-testid="start-grid-resize"
              onMouseDown={startGridResize}
            />
          </>
        )}
      </EditorViewport>
    </>
  );
}

test("renders the full 1200 source interaction surface", () => {
  render(<EditorViewportHarness />);

  expect(screen.getByTestId("editor-viewport")).toHaveStyle({
    top: "0px",
    left: "0px",
    width: "1200px",
    height: "1200px"
  });
});

test("renders a document-sized source interaction surface", () => {
  render(
    <EditorViewportHarness
      documentSize={{
        width: 1200,
        height: 1697
      }}
    />
  );

  expect(screen.getByTestId("editor-viewport")).toHaveStyle({
    top: "0px",
    left: "0px",
    width: "1200px",
    height: "1697px"
  });
});

test("crop move updates top and left only", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-crop-move"));
  movePointer(25, -10);

  expect(readState("crop-state")).toEqual({
    top: 90,
    left: 105,
    width: 900,
    height: 700
  });
});

test("crop move does not mutate gridArea", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-crop-move"));
  movePointer(25, -10);

  expect(readState("grid-state")).toEqual(initialGridArea);
});

test("crop movement clamps to source boundaries", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-crop-move"));
  movePointer(1000, 1000);

  expect(readState("crop-state")).toEqual({
    top: 500,
    left: 300,
    width: 900,
    height: 700
  });
});

test("crop movement clamps to documentSize boundaries", () => {
  render(
    <EditorViewportHarness
      documentSize={{
        width: 1200,
        height: 1697
      }}
    />
  );

  fireEvent.mouseDown(screen.getByTestId("start-crop-move"));
  movePointer(1000, 1000);

  expect(readState("crop-state")).toEqual({
    top: 997,
    left: 300,
    width: 900,
    height: 700
  });
});

test("crop resize updates width and height only", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-crop-resize"));
  movePointer(50, -20);

  expect(readState("crop-state")).toEqual({
    top: 100,
    left: 80,
    width: 950,
    height: 680
  });
});

test("crop resize does not mutate gridArea", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-crop-resize"));
  movePointer(50, -20);

  expect(readState("grid-state")).toEqual(initialGridArea);
});

test("crop resize clamps to minimum and source boundaries", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-crop-resize"));
  movePointer(1000, 1000);

  expect(readState("crop-state")).toEqual({
    top: 100,
    left: 80,
    width: 1120,
    height: 1100
  });

  movePointer(-2000, -2000);

  expect(readState("crop-state")).toEqual({
    top: 100,
    left: 80,
    width: 100,
    height: 100
  });
});

test("crop resize clamps to documentSize boundaries", () => {
  render(
    <EditorViewportHarness
      documentSize={{
        width: 1200,
        height: 1697
      }}
    />
  );

  fireEvent.mouseDown(screen.getByTestId("start-crop-resize"));
  movePointer(1000, 1000);

  expect(readState("crop-state")).toEqual({
    top: 100,
    left: 80,
    width: 1120,
    height: 1597
  });
});

test("existing grid move remains protected", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-grid-move"), {
    clientX: 100,
    clientY: 100
  });
  moveClientPointer(125, 90);

  expect(readState("grid-state")).toEqual({
    top: 10,
    left: 55,
    width: 400,
    height: 300
  });
  expect(readState("crop-state")).toEqual(initialCropArea);
});

test("grid movement supports diagonal dragging", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-grid-move"), {
    clientX: 100,
    clientY: 100
  });
  moveClientPointer(130, 140);

  expect(readState("grid-state")).toEqual({
    top: 60,
    left: 60,
    width: 400,
    height: 300
  });
});

test("grid movement is based on client coordinates from drag start", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-grid-move"), {
    clientX: 100,
    clientY: 100
  });
  movePointerWithClientCoordinates({
    clientX: 110,
    clientY: 115,
    movementX: 999,
    movementY: 999
  });

  expect(readState("grid-state")).toEqual({
    top: 35,
    left: 40,
    width: 400,
    height: 300
  });
});

test("grid resize preserves top and left", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-grid-resize"), {
    clientX: 100,
    clientY: 100
  });
  moveClientPointer(130, 140);

  expect(readState("grid-state")).toEqual({
    top: 20,
    left: 30,
    width: 430,
    height: 340
  });
});

test("grid resize changes only width and height", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-grid-resize"), {
    clientX: 100,
    clientY: 100
  });
  movePointerWithClientCoordinates({
    clientX: 150,
    clientY: 120,
    movementX: -500,
    movementY: -500
  });

  expect(readState("grid-state")).toEqual({
    top: 20,
    left: 30,
    width: 450,
    height: 320
  });
});

function readState(testId) {
  return JSON.parse(screen.getByTestId(testId).textContent);
}

function movePointer(movementX, movementY) {
  movePointerWithClientCoordinates({
    clientX: 0,
    clientY: 0,
    movementX,
    movementY
  });
}

function moveClientPointer(clientX, clientY) {
  movePointerWithClientCoordinates({
    clientX,
    clientY,
    movementX: 0,
    movementY: 0
  });
}

function movePointerWithClientCoordinates({
  clientX,
  clientY,
  movementX,
  movementY
}) {
  const event = new MouseEvent("mousemove", {
    bubbles: true,
    clientX,
    clientY
  });

  Object.defineProperty(event, "movementX", {
    value: movementX
  });
  Object.defineProperty(event, "movementY", {
    value: movementY
  });

  fireEvent(window, event);
}
