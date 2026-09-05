import { fireEvent, render, screen } from "@testing-library/react";
import EditorLayer from "./EditorLayer";

const baseProps = {
  rows: 2,
  cols: 2,
  cellTypes: ["write", "blocked", "double", "empty"],
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

test("forwards explicit document-space grid lines into the grid frame", () => {
  render(
    <EditorLayer
      {...baseProps}
      gridLineProposal={{
        horizontalLinePositions: [21, 170, 319],
        verticalLinePositions: [31, 230, 429],
        referenceGridArea: baseProps.gridArea
      }}
    />
  );

  expect(screen.getByTestId("editor-grid-line-horizontal-0"))
    .toHaveAttribute("data-line-position", "1");
  expect(screen.getByTestId("editor-grid-line-horizontal-2"))
    .toHaveAttribute("data-line-position", "299");
  expect(screen.getByTestId("editor-grid-line-vertical-0"))
    .toHaveAttribute("data-line-position", "1");
  expect(screen.getByTestId("editor-grid-line-vertical-2"))
    .toHaveAttribute("data-line-position", "399");
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
  expect(baseProps.startGridResize).not.toHaveBeenCalled();
});

test("starts crop resize from crop resize handle", () => {
  render(<EditorLayer {...baseProps} />);

  fireEvent.mouseDown(screen.getByTestId("editor-crop-resize-handle"));

  expect(baseProps.setCropMode).toHaveBeenCalledWith("resize");
  expect(baseProps.startGridResize).not.toHaveBeenCalled();
});

test("crop affordances stay active outside competition mode", () => {
  render(<EditorLayer {...baseProps} activeTool="write" />);

  expect(screen.getByTestId("editor-crop-move-affordance")).toHaveStyle({
    pointerEvents: "auto"
  });
  expect(screen.getByTestId("editor-crop-resize-handle")).toHaveStyle({
    pointerEvents: "auto"
  });
});

test("crop affordances do not intercept cell clicks while competition tool is active", () => {
  render(<EditorLayer {...baseProps} activeTool="competition" />);

  expect(screen.getByTestId("editor-crop-move-affordance")).toHaveStyle({
    pointerEvents: "none"
  });
  expect(screen.getByTestId("editor-crop-resize-handle")).toHaveStyle({
    pointerEvents: "none"
  });
});

test("grid affordances stay active outside competition mode", () => {
  render(<EditorLayer {...baseProps} activeTool="write" />);

  expect(screen.getByTestId("editor-grid-move-affordance")).toHaveStyle({
    pointerEvents: "auto"
  });
  expect(screen.getByTestId("editor-grid-resize-handle")).toHaveStyle({
    pointerEvents: "auto"
  });
});

test("grid affordances do not intercept cell clicks while competition tool is active", () => {
  render(<EditorLayer {...baseProps} activeTool="competition" />);

  expect(screen.getByTestId("editor-grid-move-affordance")).toHaveStyle({
    pointerEvents: "none"
  });
  expect(screen.getByTestId("editor-grid-resize-handle")).toHaveStyle({
    pointerEvents: "none"
  });
});

test("uses the purple top edge for top grid resize", () => {
  render(<EditorLayer {...baseProps} />);
  const topEdge = screen.getByTestId("editor-grid-move-affordance");

  fireEvent.mouseDown(topEdge);

  expect(baseProps.startGridResize).toHaveBeenCalledTimes(1);
  expect(baseProps.startGridResize).toHaveBeenCalledWith(
    expect.anything(),
    "top"
  );
  expect(topEdge).toHaveStyle({
    top: "0px",
    height: "24px",
    borderTop: "2px solid rgba(90,0,180,0.8)"
  });
});

test("bottom-right resize handle does not trigger top-edge behavior", () => {
  render(<EditorLayer {...baseProps} />);

  fireEvent.mouseDown(screen.getByTestId("editor-grid-resize-handle"));

  expect(baseProps.startGridResize).toHaveBeenCalledTimes(1);
  expect(baseProps.startGridResize).toHaveBeenCalledWith(
    expect.anything(),
    "corner"
  );
});

test("does not render separate edge resize handles", () => {
  render(<EditorLayer {...baseProps} />);

  expect(screen.queryByTestId("editor-grid-resize-top-handle")).not.toBeInTheDocument();
  expect(screen.queryByTestId("editor-grid-resize-left-handle")).not.toBeInTheDocument();
  expect(screen.queryByTestId("editor-grid-resize-right-handle")).not.toBeInTheDocument();
});

test("grid frame preserves cell editing click handling", () => {
  render(<EditorLayer {...baseProps} />);

  fireEvent.click(screen.getByTestId("editor-grid-frame"));

  expect(baseProps.handleGridClick).toHaveBeenCalled();
});
