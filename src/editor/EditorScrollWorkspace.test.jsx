import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import EditorLayer from "./EditorLayer";
import EditorScrollWorkspace, { getEditorFitScale } from "./EditorScrollWorkspace";

let resizeObserverCallback;

beforeEach(() => {
  resizeObserverCallback = null;
  global.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      resizeObserverCallback = callback;
    }

    observe() {}

    disconnect() {}
  };
});

const editorLayerProps = {
  rows: 2,
  cols: 2,
  cellTypes: ["write", "blocked", "double", "empty"],
  setMode: jest.fn(),
  setCropMode: jest.fn(),
  handleGridClick: jest.fn(),
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
  delete global.ResizeObserver;
});

test("editor workspace is horizontally and vertically scrollable", () => {
  render(
    <EditorScrollWorkspace>
      <div />
    </EditorScrollWorkspace>
  );

  expect(screen.getByTestId("editor-scroll-workspace")).toHaveStyle({
    overflow: "auto",
    maxWidth: "calc(100vw - 220px)",
    maxHeight: "calc(100vh - 78px)"
  });
});

test("source frame remains fixed at 1200 by 1200", () => {
  render(
    <EditorScrollWorkspace>
      <div />
    </EditorScrollWorkspace>
  );

  expect(screen.getByTestId("editor-scroll-source-frame")).toHaveStyle({
    width: "1200px",
    height: "1200px",
    transform: "scale(1)"
  });
});

test("fit frame scales the source surface to available workspace", () => {
  render(
    <EditorScrollWorkspace>
      <div />
    </EditorScrollWorkspace>
  );

  act(() => {
    resizeObserverCallback([
      {
        contentRect: {
          width: 600,
          height: 900
        }
      }
    ]);
  });

  expect(screen.getByTestId("editor-scroll-fit-frame")).toHaveStyle({
    width: "600px",
    height: "600px"
  });
  expect(screen.getByTestId("editor-scroll-source-frame")).toHaveStyle({
    width: "1200px",
    height: "1200px",
    transform: "scale(0.5)"
  });
});

test("fit frame respects documentSize aspect ratio", () => {
  render(
    <EditorScrollWorkspace
      documentSize={{
        width: 1200,
        height: 1697
      }}
    >
      <div />
    </EditorScrollWorkspace>
  );

  act(() => {
    resizeObserverCallback([
      {
        contentRect: {
          width: 600,
          height: 1200
        }
      }
    ]);
  });

  expect(screen.getByTestId("editor-scroll-fit-frame")).toHaveStyle({
    width: "600px",
    height: "848.5px"
  });
  expect(screen.getByTestId("editor-scroll-source-frame")).toHaveStyle({
    width: "1200px",
    height: "1697px",
    transform: "scale(0.5)"
  });
});

test("fit scale never enlarges the source surface", () => {
  expect(getEditorFitScale({
    width: 1200,
    height: 1200
  }, {
    width: 2000,
    height: 2000
  })).toBe(1);
});

test("renders compact zoom controls above the workspace", () => {
  render(
    <EditorScrollWorkspace>
      <div />
    </EditorScrollWorkspace>
  );

  const controls = screen.getByTestId("editor-zoom-controls");

  expect(controls).toContainElement(screen.getByText("Zoom"));
  expect(controls).toContainElement(screen.getByRole("button", { name: "-" }));
  expect(controls).toContainElement(screen.getByText("100 %"));
  expect(controls).toContainElement(screen.getByRole("button", { name: "+" }));
  expect(controls).toContainElement(
    screen.getByRole("button", { name: "Anpassa" })
  );
});

test("zoom buttons adjust the editor source scale", () => {
  render(
    <EditorScrollWorkspace>
      <div />
    </EditorScrollWorkspace>
  );

  act(() => {
    resizeObserverCallback([
      {
        contentRect: {
          width: 600,
          height: 900
        }
      }
    ]);
  });

  fireEvent.click(screen.getByRole("button", { name: "+" }));

  expect(screen.getByTestId("editor-zoom-value")).toHaveTextContent("60 %");
  expect(screen.getByTestId("editor-scroll-source-frame")).toHaveStyle({
    transform: "scale(0.6)"
  });

  fireEvent.click(screen.getByRole("button", { name: "-" }));

  expect(screen.getByTestId("editor-zoom-value")).toHaveTextContent("50 %");
  expect(screen.getByTestId("editor-scroll-source-frame")).toHaveStyle({
    transform: "scale(0.5)"
  });
});

test("fit control restores the current fit scale", () => {
  render(
    <EditorScrollWorkspace>
      <div />
    </EditorScrollWorkspace>
  );

  act(() => {
    resizeObserverCallback([
      {
        contentRect: {
          width: 600,
          height: 900
        }
      }
    ]);
  });

  fireEvent.click(screen.getByRole("button", { name: "+" }));
  fireEvent.click(screen.getByRole("button", { name: "Anpassa" }));

  expect(screen.getByTestId("editor-zoom-value")).toHaveTextContent("50 %");
  expect(screen.getByTestId("editor-scroll-source-frame")).toHaveStyle({
    transform: "scale(0.5)"
  });
});

test("controlled zoom level is preserved after workspace remount", () => {
  function ControlledWorkspaceHarness({ visible }) {
    const [zoomState, setZoomState] = useState({
      fitScale: 1,
      scale: 1,
      zoomMode: "fit"
    });

    return visible ? (
      <EditorScrollWorkspace
        zoomState={zoomState}
        setZoomState={setZoomState}
      >
        <div />
      </EditorScrollWorkspace>
    ) : null;
  }

  const { rerender } = render(<ControlledWorkspaceHarness visible />);

  fireEvent.click(screen.getByRole("button", { name: "-" }));

  expect(screen.getByTestId("editor-zoom-value")).toHaveTextContent("90 %");

  rerender(<ControlledWorkspaceHarness visible={false} />);
  rerender(<ControlledWorkspaceHarness visible />);

  expect(screen.getByTestId("editor-zoom-value")).toHaveTextContent("90 %");
});

test("grid and crop coordinates do not change when workspace scrolls", () => {
  render(
    <EditorScrollWorkspace>
      <EditorLayer {...editorLayerProps} />
    </EditorScrollWorkspace>
  );

  const workspace = screen.getByTestId("editor-scroll-workspace");

  workspace.scrollLeft = 200;
  workspace.scrollTop = 150;
  fireEvent.scroll(workspace);

  expect(screen.getByTestId("editor-crop-overlay")).toHaveStyle({
    top: "100px",
    left: "80px",
    width: "900px",
    height: "700px"
  });
  expect(screen.getByTestId("editor-grid-frame")).toHaveStyle({
    top: "20px",
    left: "30px",
    width: "400px",
    height: "300px"
  });
});
