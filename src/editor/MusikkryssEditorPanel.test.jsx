import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import MusikkryssEditorPanel from "./MusikkryssEditorPanel";
import { createEmptyMusikkryssContent } from "../musikkryss/MusikkryssFormat";
import {
  createMusikkryssReferenceContent
} from "../musikkryss/MusikkryssReferenceContentPack";

function Harness({ initialValue = createEmptyMusikkryssContent() }) {
  const [value, setValue] = useState(initialValue);
  const [crosswordId, setCrosswordId] = useState("");
  return (
    <>
      <div data-testid="musikkryss-state">{JSON.stringify(value)}</div>
      <div data-testid="session-crossword-id">{crosswordId}</div>
      <MusikkryssEditorPanel
        value={value}
        onChange={setValue}
        onCrosswordIdChange={setCrosswordId}
        onLoadReference={() => setValue(createMusikkryssReferenceContent())}
      />
    </>
  );
}

test("edits intro and independently selectable directional answer text", () => {
  render(<Harness />);

  expect(screen.getAllByRole("button", { name: /\d+ (vågrätt|lodrätt)/ }))
    .toHaveLength(15);
  fireEvent.change(screen.getByRole("textbox", { name: "Intro" }), {
    target: { value: "Välkommen till veckans musikkryss" }
  });
  fireEvent.click(screen.getByRole("button", { name: "13 vågrätt" }));
  fireEvent.change(screen.getByRole("textbox", {
    name: "Innehåll för 13 vågrätt"
  }), {
    target: { value: "Vilken artist hör vi?" }
  });

  const state = JSON.parse(
    screen.getByTestId("musikkryss-state").textContent
  );
  expect(state.introScript).toBe("Välkommen till veckans musikkryss");
  const answer = state.answers.find(candidate => (
    candidate.number === 13 && candidate.direction === "across"
  ));
  expect(answer.contentSequence).toEqual([{
    type: "text",
    text: "Vilken artist hör vi?"
  }]);
  expect(state.answers[0].contentSequence[0].text).toBe("");
});

test("edits all imported issue metadata as ordinary session content", () => {
  const initialValue = {
    ...createEmptyMusikkryssContent(),
    issue: {
      crosswordId: "MUSIK-OLD",
      title: "Gammal titel",
      issueNumber: "37",
      publishWeek: "2026-W37",
      publishDate: "2026-09-07",
      producerReference: "PRODUCER-37"
    }
  };
  render(<Harness initialValue={initialValue} />);

  const edits = {
    "Korsords-ID": "MUSIK-NEW",
    Titel: "Ny titel",
    Utgåva: "38",
    Publiceringsvecka: "2026-W38",
    Publiceringsdatum: "2026-09-14",
    Producentreferens: "PRODUCER-38"
  };
  Object.entries(edits).forEach(([name, value]) => {
    fireEvent.change(screen.getByLabelText(name), {
      target: { value }
    });
  });

  const state = JSON.parse(screen.getByTestId("musikkryss-state").textContent);
  expect(state.issue).toEqual({
    crosswordId: "MUSIK-NEW",
    title: "Ny titel",
    issueNumber: "38",
    publishWeek: "2026-W38",
    publishDate: "2026-09-14",
    producerReference: "PRODUCER-38"
  });
  expect(screen.getByTestId("session-crossword-id"))
    .toHaveTextContent("MUSIK-NEW");
});

test("keeps across and down content independent for one printed number", () => {
  render(<Harness />);

  fireEvent.click(screen.getByRole("button", { name: "1 vågrätt" }));
  fireEvent.change(screen.getByRole("textbox", {
    name: "Innehåll för 1 vågrätt"
  }), { target: { value: "Vågrätt innehåll" } });
  fireEvent.click(screen.getByRole("button", { name: "1 lodrätt" }));
  fireEvent.change(screen.getByRole("textbox", {
    name: "Innehåll för 1 lodrätt"
  }), { target: { value: "Lodrätt innehåll" } });

  const state = JSON.parse(
    screen.getByTestId("musikkryss-state").textContent
  );
  expect(state.answers.find(answer => (
    answer.number === 1 && answer.direction === "across"
  )).contentSequence[0].text).toBe("Vågrätt innehåll");
  expect(state.answers.find(answer => (
    answer.number === 1 && answer.direction === "down"
  )).contentSequence[0].text).toBe("Lodrätt innehåll");
  expect(screen.getByRole("button", { name: "1 lodrätt" }))
    .toHaveAttribute("aria-pressed", "true");
});

test("loads the complete reference issue only on explicit action", () => {
  render(<Harness />);

  expect(JSON.parse(screen.getByTestId("musikkryss-state").textContent)
    .answers[0]).not.toHaveProperty("solution");

  fireEvent.click(screen.getByRole("button", { name: "Ladda referenskryss" }));

  const state = JSON.parse(
    screen.getByTestId("musikkryss-state").textContent
  );
  expect(state.answers).toHaveLength(15);
  expect(state.answers.every(answer => answer.solution)).toBe(true);
  expect(state.answers.every(answer => answer.contentSequence[0].text)).toBe(true);
  expect(state.introScript).toContain("Välkommen till Musikkrysset!");
});

test("edits durable solutions and reports length and crossing errors", () => {
  const initialValue = createMusikkryssReferenceContent();
  const originalDown = initialValue.answers.find(answer => (
    answer.number === 1 && answer.direction === "down"
  ));
  const originalPath = initialValue.answers.find(answer => (
    answer.number === 1 && answer.direction === "across"
  )).answerPath;
  render(<Harness initialValue={initialValue} />);

  fireEvent.change(screen.getByRole("textbox", {
    name: "Facit för 1 vågrätt"
  }), { target: { value: "A" } });
  expect(screen.getByText(
    "Lösningen har 1 tecken; svarsvägen kräver 8."
  )).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId("musikkryss-state").textContent)
    .answers.find(answer => (
      answer.number === 1 && answer.direction === "across"
    )).solution).toBe("A");

  fireEvent.change(screen.getByRole("textbox", {
    name: "Facit för 1 vågrätt"
  }), { target: { value: "ZAMMERED" } });
  expect(screen.getByText(/Korsningskonflikt i cell 1: (H\/Z|Z\/H)\./))
    .toBeInTheDocument();
  expect(screen.getByLabelText("Facitvalidering"))
    .toHaveTextContent("Facit har korsningskonflikter.");

  fireEvent.change(screen.getByRole("textbox", {
    name: "Facit för 1 vågrätt"
  }), { target: { value: "HAMMERED" } });
  expect(screen.getByLabelText("Facitvalidering"))
    .toHaveTextContent("Facit är komplett och giltigt.");
  expect(screen.queryByText(/Korsningskonflikt/)).not.toBeInTheDocument();

  const state = JSON.parse(screen.getByTestId("musikkryss-state").textContent);
  expect(state.answers.find(answer => (
    answer.number === 1 && answer.direction === "across"
  )).answerPath).toEqual(originalPath);
  expect(state.answers.find(answer => (
    answer.number === 1 && answer.direction === "down"
  ))).toEqual(originalDown);
});
