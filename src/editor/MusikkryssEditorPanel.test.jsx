import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import MusikkryssEditorPanel from "./MusikkryssEditorPanel";
import { createEmptyMusikkryssContent } from "../musikkryss/MusikkryssFormat";
import {
  createMusikkryssReferenceContent
} from "../musikkryss/MusikkryssReferenceContentPack";

function Harness() {
  const [value, setValue] = useState(createEmptyMusikkryssContent);
  return (
    <>
      <div data-testid="musikkryss-state">{JSON.stringify(value)}</div>
      <MusikkryssEditorPanel
        value={value}
        onChange={setValue}
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
