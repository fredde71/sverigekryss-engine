import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import MusikkryssEditorPanel from "./MusikkryssEditorPanel";
import { createEmptyMusikkryssContent } from "../musikkryss/MusikkryssFormat";

function Harness() {
  const [value, setValue] = useState(createEmptyMusikkryssContent);
  return (
    <>
      <div data-testid="musikkryss-state">{JSON.stringify(value)}</div>
      <MusikkryssEditorPanel value={value} onChange={setValue} />
    </>
  );
}

test("edits the intro and independently selectable clue text", () => {
  render(<Harness />);

  expect(screen.getAllByRole("button", { name: /Ledtråd \d+/ }))
    .toHaveLength(13);
  fireEvent.change(screen.getByRole("textbox", { name: "Intro" }), {
    target: { value: "Välkommen till veckans musikkryss" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Ledtråd 13" }));
  fireEvent.change(screen.getByRole("textbox", {
    name: "Innehåll för ledtråd 13"
  }), {
    target: { value: "Vilken artist hör vi?" }
  });

  const state = JSON.parse(
    screen.getByTestId("musikkryss-state").textContent
  );
  expect(state.introScript).toBe("Välkommen till veckans musikkryss");
  expect(state.clues[12].contentSequence).toEqual([{
    type: "text",
    text: "Vilken artist hör vi?"
  }]);
  expect(state.clues[0].contentSequence[0].text).toBe("");
});
