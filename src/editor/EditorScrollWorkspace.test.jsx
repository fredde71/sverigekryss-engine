import { fireEvent, render, screen } from "@testing-library/react";
import EditorLayer from "./EditorLayer";
import EditorScrollWorkspace from "./EditorScrollWorkspace";

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
});

test("editor workspace is horizontally and vertically scrollable", () => {
  render(
    <EditorScrollWorkspace>
      <div />
    </EditorScrollWorkspace>
  );

  expect(screen.getByTestId("editor-scroll-workspace")).toHaveStyle({
    overflow: "auto",
    width: "100%",
    maxWidth: "100%",
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
    height: "1200px"
  });
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
