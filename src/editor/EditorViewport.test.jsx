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
  const [currentCellTypes, setCellTypes] = useState(Array(4).fill("empty"));
  const [cropMode, setCropMode] = useState(null);

  return (
    <>
      <div data-testid="crop-state">
        {JSON.stringify(currentCropArea)}
      </div>
      <div data-testid="grid-state">
        {JSON.stringify(currentGridArea)}
      </div>
      <div data-testid="cell-state">
        {JSON.stringify(currentCellTypes)}
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
        setCellTypes={setCellTypes}
      >
        {({ startGridMove, startGridResize, setCropMode, handleGridClick }) => (
          <>
            <div
              data-testid="grid-frame"
              onMouseDown={startGridMove}
              onClick={handleGridClick}
            />
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
            <button
              data-testid="start-grid-resize-top"
              onMouseDown={(e) => startGridResize(e, "top")}
            />
            <button
              data-testid="start-grid-resize-left"
              onMouseDown={(e) => startGridResize(e, "left")}
            />
            <button
              data-testid="start-grid-resize-right"
              onMouseDown={(e) => startGridResize(e, "right")}
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

test("dragging grid frame updates top and left", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("grid-frame"), {
    clientX: 100,
    clientY: 100
  });
  moveClientPointer(135, 125);

  expect(readState("grid-state")).toEqual({
    top: 45,
    left: 65,
    width: 400,
    height: 300
  });
});

test("dragging grid frame does not trigger cell editing", () => {
  render(<EditorViewportHarness />);

  const gridFrame = screen.getByTestId("grid-frame");
  mockGridFrameRect(gridFrame);

  fireEvent.mouseDown(gridFrame, {
    clientX: 100,
    clientY: 100
  });
  moveClientPointer(135, 125);
  fireEvent.click(gridFrame, {
    clientX: 135,
    clientY: 125
  });

  expect(readState("cell-state")).toEqual([
    "empty",
    "empty",
    "empty",
    "empty"
  ]);
});

test("click without drag still edits cells", () => {
  render(<EditorViewportHarness />);

  const gridFrame = screen.getByTestId("grid-frame");
  mockGridFrameRect(gridFrame);

  fireEvent.click(gridFrame, {
    clientX: 10,
    clientY: 10
  });

  expect(readState("cell-state")).toEqual([
    "write",
    "empty",
    "empty",
    "empty"
  ]);
});

test("bottom grid resize preserves top edge", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-grid-resize"), {
    clientX: 100,
    clientY: 100
  });
  moveClientPointer(130, 140);

  expect(readState("grid-state")).toEqual({
    top: 20,
    left: 30,
    width: 400,
    height: 340
  });
});

test("top grid resize preserves bottom edge", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-grid-resize-top"), {
    clientX: 100,
    clientY: 100
  });
  moveClientPointer(100, 140);

  expect(readState("grid-state")).toEqual({
    top: 60,
    left: 30,
    width: 400,
    height: 260
  });
});

test("left grid resize preserves right edge", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-grid-resize-left"), {
    clientX: 100,
    clientY: 100
  });
  moveClientPointer(150, 100);

  expect(readState("grid-state")).toEqual({
    top: 20,
    left: 80,
    width: 350,
    height: 300
  });
});

test("right grid resize preserves left edge", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-grid-resize-right"), {
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
    height: 300
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

function mockGridFrameRect(element) {
  element.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    right: 400,
    bottom: 300,
    width: 400,
    height: 300
  });
}
