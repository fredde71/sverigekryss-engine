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
    maxHeight: "calc(100vh - 40px)"
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
