import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EditorSessionWorkspace from "./EditorSessionWorkspace";

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
