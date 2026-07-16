import { fireEvent, render, screen } from "@testing-library/react";
import EditorLayer from "./EditorLayer";

const baseProps = {
  rows: 2,
  cols: 2,
  cellTypes: ["write", "blocked", "double", "empty"],
  setMode: jest.fn(),
  isPublicRuntime: false,
  gridArea: {
    top: 20,
    left: 30,
    width: 400,
    height: 300
  },
  cropArea: {
    top: 100,
    left: 80,
    width: 900,
    height: 700
  }
};

afterEach(() => {
  jest.clearAllMocks();
});

test("renders crop rectangle in source coordinate space", () => {
  render(<EditorLayer {...baseProps} />);

  expect(screen.getByTestId("editor-crop-overlay")).toHaveStyle({
    top: "80px",
    left: "50px",
    width: "900px",
    height: "700px",
    border: "2px dashed rgba(255, 140, 0, 0.95)"
  });
});

test("renders crop move affordance and resize handle", () => {
  render(<EditorLayer {...baseProps} />);

  expect(screen.getByTestId("editor-crop-move-affordance")).toBeInTheDocument();
  expect(screen.getByTestId("editor-crop-resize-handle")).toBeInTheDocument();
});

test("keeps existing grid overlay move and resize behavior", () => {
  render(<EditorLayer {...baseProps} />);

  fireEvent.mouseDown(screen.getByTestId("editor-grid-move-affordance"));
  fireEvent.mouseDown(screen.getByTestId("editor-grid-resize-handle"));

  expect(baseProps.setMode).toHaveBeenCalledWith("move");
  expect(baseProps.setMode).toHaveBeenCalledWith("resize");
});
