import { fireEvent, render, screen } from "@testing-library/react";
import SubmissionDialog from "./SubmissionDialog";

test("focus moves into the dialog when opened", () => {
  render(<SubmissionDialog onClose={() => {}} onSubmit={() => {}} />);

  expect(screen.getByRole("dialog")).toHaveFocus();
});

test("Avbryt closes the dialog", () => {
  const onClose = jest.fn();

  render(<SubmissionDialog onClose={onClose} onSubmit={() => {}} />);

  fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));

  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Escape closes the dialog", () => {
  const onClose = jest.fn();

  render(<SubmissionDialog onClose={onClose} onSubmit={() => {}} />);

  fireEvent.keyDown(document, { key: "Escape" });

  expect(onClose).toHaveBeenCalledTimes(1);
});

test("clicking outside closes the dialog", () => {
  const onClose = jest.fn();

  render(<SubmissionDialog onClose={onClose} onSubmit={() => {}} />);

  fireEvent.mouseDown(screen.getByTestId("submission-dialog-backdrop"));

  expect(onClose).toHaveBeenCalledTimes(1);
});

test("clicking inside does not close the dialog", () => {
  const onClose = jest.fn();

  render(<SubmissionDialog onClose={onClose} onSubmit={() => {}} />);

  fireEvent.mouseDown(screen.getByRole("dialog"));

  expect(onClose).not.toHaveBeenCalled();
});

test("submit button is disabled until required fields are valid", () => {
  render(<SubmissionDialog onClose={() => {}} onSubmit={() => {}} />);

  const submitButton = screen.getByRole("button", { name: "Skicka" });

  expect(submitButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Namn *"), {
    target: { value: "Fredrik" }
  });
  fireEvent.change(screen.getByLabelText("E-post *"), {
    target: { value: "inte-en-epost" }
  });
  fireEvent.change(screen.getByLabelText("Telefonnummer *"), {
    target: { value: "0701234567" }
  });

  expect(submitButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText("E-post *"), {
    target: { value: "fredrik@example.com" }
  });

  expect(submitButton).toBeEnabled();
});

test("Skicka calls onSubmit with submission payload", () => {
  const onSubmit = jest.fn();

  render(<SubmissionDialog onClose={() => {}} onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText("Namn *"), {
    target: { value: " Fredrik " }
  });
  fireEvent.change(screen.getByLabelText("E-post *"), {
    target: { value: " fredrik@example.com " }
  });
  fireEvent.change(screen.getByLabelText("Telefonnummer *"), {
    target: { value: " 0701234567 " }
  });
  fireEvent.click(screen.getByRole("button", { name: "Skicka" }));

  expect(onSubmit).toHaveBeenCalledWith({
    solution: ["", "", "", "", "", ""],
    name: "Fredrik",
    email: "fredrik@example.com",
    phone: "0701234567"
  });
});
