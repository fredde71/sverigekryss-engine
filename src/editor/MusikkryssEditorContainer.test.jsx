import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import MusikkryssEditorContainer from "./MusikkryssEditorContainer";
import { createEmptyMusikkryssContent } from "../musikkryss/MusikkryssFormat";
import { createMusikkryssTemplate } from "../musikkryss/MusikkryssTemplateInitializer";

jest.mock("./EditorScrollWorkspace", () => ({ children }) => (
  <div data-testid="scroll-workspace">{children}</div>
));

test("owns Musikkryss panel and mounts the supplied editor in TemplateCanvas", () => {
  const onMusikkryssChange = jest.fn();

  render(
    <MusikkryssEditorContainer
      template={{
        crosswordType: "musikkryss",
        rows: 9,
        cols: 10,
        cellTypes: Array(90).fill("empty"),
        imageSrc: "musik.png",
        documentSize: { width: 980, height: 1080 },
        gridArea: { top: 60, left: 40, width: 900, height: 810 },
        cropArea: { top: 0, left: 0, width: 980, height: 1080 }
      }}
      editor={<div data-testid="musikkryss-grid-layer">grid</div>}
      musikkryss={createEmptyMusikkryssContent()}
      onMusikkryssChange={onMusikkryssChange}
      zoomState={{ fitScale: 1, scale: 1, zoomMode: "fit" }}
      setZoomState={jest.fn()}
      scrollState={{ top: 0, left: 0 }}
      setScrollState={jest.fn()}
      documentLifecycleId={1}
    />
  );

  expect(screen.getByTestId("musikkryss-editor-container")).toBeInTheDocument();
  expect(screen.getByTestId("musikkryss-editor-panel")).toBeInTheDocument();
  expect(screen.getByTestId("template-canvas-source")).toBeInTheDocument();
  expect(screen.getByTestId("musikkryss-grid-layer")).toBeInTheDocument();

  fireEvent.change(screen.getByRole("textbox", { name: "Intro" }), {
    target: { value: "Musikintro" }
  });
  expect(onMusikkryssChange).toHaveBeenCalledWith(expect.objectContaining({
    introScript: "Musikintro"
  }));
});

test("shows topology-derived paths for independently selectable answers", () => {
  function Harness() {
    const [musikkryss, setMusikkryss] = useState(createEmptyMusikkryssContent);
    const template = createMusikkryssTemplate({
      documentSize: { width: 490, height: 540 },
      imageSrc: "musik.png"
    });

    return (
      <>
        <output data-testid="musikkryss-content">
          {JSON.stringify(musikkryss)}
        </output>
        <MusikkryssEditorContainer
          template={{ ...template, musikkryss }}
          editor={<div data-testid="musikkryss-grid-layer">grid</div>}
          musikkryss={musikkryss}
          onMusikkryssChange={setMusikkryss}
          zoomState={{ fitScale: 1, scale: 1, zoomMode: "fit" }}
          setZoomState={jest.fn()}
          scrollState={{ top: 0, left: 0 }}
          setScrollState={jest.fn()}
          documentLifecycleId={1}
        />
      </>
    );
  }

  render(<Harness />);
  expect(screen.getByTestId("musikkryss-answer-path-overlay"))
    .toHaveAttribute("data-path-mode", "derived");
  expect(screen.getByTestId("musikkryss-path-cell-0")).toHaveTextContent("1");
  expect(screen.getByTestId("musikkryss-path-cell-7")).toHaveTextContent("8");
  expect(screen.getByRole("button", { name: "Härledd svarscell 1" }))
    .toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "1 lodrätt" }));
  expect(screen.getByTestId("musikkryss-path-cell-0")).toHaveTextContent("1");
  expect(screen.getByTestId("musikkryss-path-cell-70")).toHaveTextContent("8");
  expect(screen.queryByTestId("musikkryss-path-cell-7"))
    .not.toBeInTheDocument();
});
