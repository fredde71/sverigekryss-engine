import { fireEvent, render, screen } from "@testing-library/react";
import EditorPlayModeSwitch from "./EditorPlayModeSwitch";

test("shows a clear Editor and Play choice and delegates mode changes", () => {
  const onChange = jest.fn();

  const { rerender } = render(
    <EditorPlayModeSwitch value="edit" onChange={onChange} />
  );

  expect(screen.getByRole("button", { name: "Redigera" }))
    .toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Spela" }))
    .toHaveAttribute("aria-pressed", "false");

  fireEvent.click(screen.getByRole("button", { name: "Spela" }));
  expect(onChange).toHaveBeenCalledWith("play");

  rerender(<EditorPlayModeSwitch value="play" onChange={onChange} />);
  expect(screen.getByRole("button", { name: "Redigera" }))
    .toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Spela" }))
    .toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: "Redigera" }));
  expect(onChange).toHaveBeenLastCalledWith("edit");
});
