import { fireEvent, render, screen } from "@testing-library/react";
import EditorLayer from "./EditorLayer";

const baseProps = {
  rows: 2,
  cols: 2,
  cellTypes: ["write", "blocked", "double", "empty"],
  startGridMove: jest.fn(),
  startGridResize: jest.fn(),
  setCropMode: jest.fn(),
  handleGridClick: jest.fn(),
  isPublicRuntime: false,
  documentSize: {
    width: 1200,
    height: 1200
  },
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
    top: "100px",
    left: "80px",
    width: "900px",
    height: "700px",
    border: "2px dashed rgba(255, 140, 0, 0.95)"
  });
});

test("renders editor overlay with documentSize dimensions", () => {
  render(
    <EditorLayer
      {...baseProps}
      documentSize={{
        width: 1200,
        height: 1697
      }}
    />
  );

  expect(screen.getByTestId("editor-layer")).toHaveStyle({
    width: "1200px",
    height: "1697px"
  });
});

test("missing cropArea defaults to full documentSize", () => {
  render(
    <EditorLayer
      {...baseProps}
      documentSize={{
        width: 1200,
        height: 1697
      }}
      cropArea={undefined}
    />
  );

  expect(screen.getByTestId("editor-crop-overlay")).toHaveStyle({
    top: "0px",
    left: "0px",
    width: "1200px",
    height: "1697px"
  });
});

test("renders grid frame in source coordinate space", () => {
  render(<EditorLayer {...baseProps} />);

  expect(screen.getByTestId("editor-grid-frame")).toHaveStyle({
    top: "20px",
    left: "30px",
    width: "400px",
    height: "300px"
  });
});

test("crop overlay no longer depends on grid position", () => {
  const { rerender } = render(<EditorLayer {...baseProps} />);

  rerender(
    <EditorLayer
      {...baseProps}
      gridArea={{
        top: 250,
        left: 300,
        width: 400,
        height: 300
      }}
    />
  );

  expect(screen.getByTestId("editor-crop-overlay")).toHaveStyle({
    top: "100px",
    left: "80px",
    width: "900px",
    height: "700px"
  });
  expect(screen.getByTestId("editor-grid-frame")).toHaveStyle({
    top: "250px",
    left: "300px"
  });
});

test("renders crop move affordance and resize handle", () => {
  render(<EditorLayer {...baseProps} />);

  expect(screen.getByTestId("editor-crop-move-affordance")).toBeInTheDocument();
  expect(screen.getByTestId("editor-crop-resize-handle")).toBeInTheDocument();
});

test("starts crop movement from crop move affordance", () => {
  render(<EditorLayer {...baseProps} />);

  fireEvent.mouseDown(screen.getByTestId("editor-crop-move-affordance"));

  expect(baseProps.setCropMode).toHaveBeenCalledWith("move");
  expect(baseProps.startGridMove).not.toHaveBeenCalled();
  expect(baseProps.startGridResize).not.toHaveBeenCalled();
});

test("starts crop resize from crop resize handle", () => {
  render(<EditorLayer {...baseProps} />);

  fireEvent.mouseDown(screen.getByTestId("editor-crop-resize-handle"));

  expect(baseProps.setCropMode).toHaveBeenCalledWith("resize");
  expect(baseProps.startGridMove).not.toHaveBeenCalled();
  expect(baseProps.startGridResize).not.toHaveBeenCalled();
});

test("keeps existing grid overlay move and resize behavior", () => {
  render(<EditorLayer {...baseProps} />);

  fireEvent.mouseDown(screen.getByTestId("editor-grid-move-affordance"));
  fireEvent.mouseDown(screen.getByTestId("editor-grid-resize-handle"));

  expect(baseProps.startGridMove).toHaveBeenCalledTimes(1);
  expect(baseProps.startGridResize).toHaveBeenCalledTimes(1);
});

test("grid frame preserves cell editing click handling", () => {
  render(<EditorLayer {...baseProps} />);

  fireEvent.click(screen.getByTestId("editor-grid-frame"));

  expect(baseProps.handleGridClick).toHaveBeenCalled();
});
