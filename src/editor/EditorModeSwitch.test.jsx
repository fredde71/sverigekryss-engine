import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import EditorModeSwitch from "./EditorModeSwitch";

test("offers one explicit top-level switch between editor types", () => {
  const onChange = jest.fn();
  render(<EditorModeSwitch value="sverigekryss" onChange={onChange} />);

  expect(screen.getByRole("button", { name: "Sverigekryss" }))
    .toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Musikkryss" }));
  expect(onChange).toHaveBeenCalledWith("musikkryss");
});
