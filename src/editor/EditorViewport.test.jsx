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

function EditorViewportHarness({
  cropArea = initialCropArea,
  gridArea = initialGridArea
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
        setGridArea={setGridArea}
        setCropArea={setCropArea}
        cropMode={cropMode}
        setCropMode={setCropMode}
        rows={2}
        cols={2}
        activeTool="write"
        setCellTypes={() => {}}
      >
        {({ setMode, setCropMode }) => (
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
              onMouseDown={() => setMode("move")}
            />
          </>
        )}
      </EditorViewport>
    </>
  );
}

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

test("existing grid move remains protected", () => {
  render(<EditorViewportHarness />);

  fireEvent.mouseDown(screen.getByTestId("start-grid-move"));
  movePointer(25, -10);

  expect(readState("grid-state")).toEqual({
    top: 10,
    left: 55,
    width: 400,
    height: 300
  });
  expect(readState("crop-state")).toEqual(initialCropArea);
});

function readState(testId) {
  return JSON.parse(screen.getByTestId(testId).textContent);
}

function movePointer(movementX, movementY) {
  const event = new MouseEvent("mousemove", {
    bubbles: true
  });

  Object.defineProperty(event, "movementX", {
    value: movementX
  });
  Object.defineProperty(event, "movementY", {
    value: movementY
  });

  fireEvent(window, event);
}
