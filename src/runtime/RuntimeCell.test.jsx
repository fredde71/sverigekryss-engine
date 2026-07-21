import { fireEvent, render, screen } from "@testing-library/react";
import RuntimeCell from "./RuntimeCell";

test("simple clue blocked cells are clickable but not writable", () => {
  const onClick = jest.fn();

  render(
    <RuntimeCell
      type="blocked"
      onClick={onClick}
      isActive={false}
    />
  );

  fireEvent.click(screen.getByTestId("runtime-clue-cell"));

  expect(onClick).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("double clue cells keep the same clickable non-writable behavior", () => {
  const onClick = jest.fn();

  render(
    <RuntimeCell
      type="double"
      onClick={onClick}
      isActive={false}
    />
  );

  fireEvent.click(screen.getByTestId("runtime-clue-cell"));

  expect(onClick).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
