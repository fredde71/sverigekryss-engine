import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EditorSessionWorkspace, {
  applyTemplateToEditorSession,
  hasEditorSessionDocumentOrGrid,
  loadMusikkryssReferenceIntoEditorSession
} from "./EditorSessionWorkspace";
import { createMusikkryssTemplate } from "../musikkryss/MusikkryssTemplateInitializer";

function Harness() {
  const [activeType, setActiveType] = React.useState("sverigekryss");

  return (
    <EditorSessionWorkspace activeType={activeType}>
      {({ session, setters, updateSession }) => (
        <>
          <button onClick={() => setActiveType("sverigekryss")}>Sverige</button>
          <button onClick={() => setActiveType("musikkryss")}>Musik</button>
          <button onClick={() => setters.setImageSrc(`${activeType}.png`)}>
            Upload
          </button>
          <button onClick={() => setters.setEditorZoomState({
            fitScale: 0.5,
            scale: activeType === "sverigekryss" ? 0.8 : 1.2,
            zoomMode: "manual"
          })}>
            Zoom
          </button>
          <button onClick={() => setters.setEditorScrollState({
            top: activeType === "sverigekryss" ? 10 : 20,
            left: activeType === "sverigekryss" ? 30 : 40
          })}>
            Scroll
          </button>
          <button onClick={() => {
            const originatingType = activeType;
            Promise.resolve().then(() => updateSession(
              originatingType,
              current => ({ ...current, digitizationResult: "done" })
            ));
            setActiveType(originatingType === "sverigekryss"
              ? "musikkryss"
              : "sverigekryss");
          }}>
            Complete later
          </button>
          <output data-testid="type">{activeType}</output>
          <output data-testid="image">{session.imageSrc || "blank"}</output>
          <output data-testid="zoom">{session.editorZoomState.scale}</output>
          <output data-testid="scroll">
            {session.editorScrollState.top},{session.editorScrollState.left}
          </output>
          <output data-testid="result">{session.digitizationResult || "none"}</output>
        </>
      )}
    </EditorSessionWorkspace>
  );
}

test("preserves independent document, zoom and scroll state by crossword type", () => {
  render(<Harness />);

  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  fireEvent.click(screen.getByRole("button", { name: "Zoom" }));
  fireEvent.click(screen.getByRole("button", { name: "Scroll" }));
  fireEvent.click(screen.getByRole("button", { name: "Musik" }));

  expect(screen.getByTestId("image")).toHaveTextContent("blank");
  expect(screen.getByTestId("zoom")).toHaveTextContent("1");
  expect(screen.getByTestId("scroll")).toHaveTextContent("0,0");

  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  fireEvent.click(screen.getByRole("button", { name: "Zoom" }));
  fireEvent.click(screen.getByRole("button", { name: "Scroll" }));
  fireEvent.click(screen.getByRole("button", { name: "Sverige" }));

  expect(screen.getByTestId("image")).toHaveTextContent("sverigekryss.png");
  expect(screen.getByTestId("zoom")).toHaveTextContent("0.8");
  expect(screen.getByTestId("scroll")).toHaveTextContent("10,30");

  fireEvent.click(screen.getByRole("button", { name: "Musik" }));
  expect(screen.getByTestId("image")).toHaveTextContent("musikkryss.png");
  expect(screen.getByTestId("zoom")).toHaveTextContent("1.2");
  expect(screen.getByTestId("scroll")).toHaveTextContent("20,40");
});

test("an asynchronous result stays with its originating session", async () => {
  render(<Harness />);

  fireEvent.click(screen.getByRole("button", { name: "Complete later" }));
  expect(screen.getByTestId("type")).toHaveTextContent("musikkryss");
  expect(screen.getByTestId("result")).toHaveTextContent("none");

  await waitFor(() => {
    expect(screen.getByTestId("result")).toHaveTextContent("none");
  });
  fireEvent.click(screen.getByRole("button", { name: "Sverige" }));
  expect(screen.getByTestId("result")).toHaveTextContent("done");
});

test("applies fixed Musikkryss template state without changing Sverigekryss", () => {
  function InitializationHarness() {
    const [activeType, setActiveType] = React.useState("sverigekryss");

    return (
      <EditorSessionWorkspace activeType={activeType}>
        {({ session, updateSession }) => (
          <>
            <button onClick={() => setActiveType("sverigekryss")}>Sverige</button>
            <button onClick={() => setActiveType("musikkryss")}>Musik</button>
            <button onClick={() => updateSession("musikkryss", current => (
              applyTemplateToEditorSession(current, createMusikkryssTemplate({
                documentSize: { width: 980, height: 1080 },
                imageSrc: "musik.png"
              }))
            ))}>
              Initiera musik
            </button>
            <output data-testid="session-summary">
              {session.crosswordType}:{session.rows}x{session.cols}:
              {session.imageSrc || "blank"}
            </output>
          </>
        )}
      </EditorSessionWorkspace>
    );
  }

  render(<InitializationHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Initiera musik" }));

  expect(screen.getByTestId("session-summary"))
    .toHaveTextContent("sverigekryss:25x25:blank");

  fireEvent.click(screen.getByRole("button", { name: "Musik" }));
  expect(screen.getByTestId("session-summary"))
    .toHaveTextContent("musikkryss:9x10:musik.png");

  fireEvent.click(screen.getByRole("button", { name: "Sverige" }));
  expect(screen.getByTestId("session-summary"))
    .toHaveTextContent("sverigekryss:25x25:blank");
});

test("loads reference content and canonical grid into a blank Musikkryss session", () => {
  const blankSession = createBlankMusikkryssSession();

  expect(hasEditorSessionDocumentOrGrid(blankSession)).toBe(false);
  const loaded = loadMusikkryssReferenceIntoEditorSession(blankSession);

  expect(loaded.rows).toBe(9);
  expect(loaded.cols).toBe(10);
  expect(loaded.cellTypes).toHaveLength(90);
  expect(loaded.cellTypes.filter(cellType => cellType === "write"))
    .toHaveLength(59);
  expect(loaded.horizontalLinePositions).toHaveLength(10);
  expect(loaded.verticalLinePositions).toHaveLength(11);
  expect(loaded.musikkryss.introScript)
    .toContain("Välkommen till Musikkrysset!");
  expect(loaded.musikkryss.answers).toHaveLength(15);
  expect(loaded.musikkryss.answers.every(answer => answer.solution)).toBe(true);
  expect(hasEditorSessionDocumentOrGrid(loaded)).toBe(true);
  expect(blankSession.rows).toBe(25);
  expect(blankSession.musikkryss.answers[0]).not.toHaveProperty("solution");
});

test("loads reference content without replacing an existing document or grid", () => {
  const existing = {
    ...createBlankMusikkryssSession(),
    imageSrc: "existing-document.png",
    rows: 3,
    cols: 4,
    cellTypes: Array(12).fill("write"),
    gridArea: { top: 11, left: 12, width: 300, height: 200 },
    horizontalLinePositions: [11, 77, 144, 211],
    verticalLinePositions: [12, 87, 162, 237, 312]
  };

  const loaded = loadMusikkryssReferenceIntoEditorSession(existing);

  expect(loaded.imageSrc).toBe(existing.imageSrc);
  expect(loaded.rows).toBe(existing.rows);
  expect(loaded.cols).toBe(existing.cols);
  expect(loaded.cellTypes).toBe(existing.cellTypes);
  expect(loaded.gridArea).toBe(existing.gridArea);
  expect(loaded.horizontalLinePositions).toBe(existing.horizontalLinePositions);
  expect(loaded.verticalLinePositions).toBe(existing.verticalLinePositions);
  expect(loaded.musikkryss.answers).toHaveLength(15);
});

function createBlankMusikkryssSession() {
  return {
    crosswordType: "musikkryss",
    crosswordId: "",
    rows: 25,
    cols: 25,
    cellTypes: Array(625).fill("empty"),
    gridArea: { top: 0, left: 0, width: 1200, height: 1200 },
    cropArea: { top: 0, left: 0, width: 1200, height: 1200 },
    competitionCells: [],
    answerPaths: [],
    horizontalLinePositions: null,
    verticalLinePositions: null,
    documentSize: { width: 1200, height: 1200 },
    imageSrc: "",
    musikkryss: createMusikkryssTemplate().musikkryss
  };
}
