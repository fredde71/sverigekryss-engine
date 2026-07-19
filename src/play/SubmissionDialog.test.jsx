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

test("typing accepts one character per solution box", () => {
  render(<SubmissionDialog onClose={() => {}} onSubmit={() => {}} />);

  fireEvent.change(screen.getByLabelText("Lösningsord position 1"), {
    target: { value: "AB" }
  });

  expect(screen.getByLabelText("Lösningsord position 1")).toHaveValue("B");
});

test("typing advances focus to the next solution box", () => {
  render(<SubmissionDialog onClose={() => {}} onSubmit={() => {}} />);

  fireEvent.change(screen.getByLabelText("Lösningsord position 1"), {
    target: { value: "A" }
  });

  expect(screen.getByLabelText("Lösningsord position 2")).toHaveFocus();
});

test("Backspace on an empty solution box moves focus to the previous box", () => {
  render(<SubmissionDialog onClose={() => {}} onSubmit={() => {}} />);

  const secondPosition = screen.getByLabelText("Lösningsord position 2");

  secondPosition.focus();
  fireEvent.keyDown(secondPosition, { key: "Backspace" });

  expect(screen.getByLabelText("Lösningsord position 1")).toHaveFocus();
});

test("pasting distributes up to six characters across solution boxes", () => {
  render(<SubmissionDialog onClose={() => {}} onSubmit={() => {}} />);

  fireEvent.paste(screen.getByLabelText("Lösningsord position 1"), {
    clipboardData: {
      getData: () => "ABCDEFZ"
    }
  });

  expect(screen.getByLabelText("Lösningsord position 1")).toHaveValue("A");
  expect(screen.getByLabelText("Lösningsord position 2")).toHaveValue("B");
  expect(screen.getByLabelText("Lösningsord position 3")).toHaveValue("C");
  expect(screen.getByLabelText("Lösningsord position 4")).toHaveValue("D");
  expect(screen.getByLabelText("Lösningsord position 5")).toHaveValue("E");
  expect(screen.getByLabelText("Lösningsord position 6")).toHaveValue("F");
});

test("initialSolution pre-populates solution boxes and remains editable", () => {
  render(
    <SubmissionDialog
      initialSolution="KORSEN"
      onClose={() => {}}
      onSubmit={() => {}}
    />
  );

  expect(screen.getByLabelText("Lösningsord position 1")).toHaveValue("K");
  expect(screen.getByLabelText("Lösningsord position 6")).toHaveValue("N");

  fireEvent.change(screen.getByLabelText("Lösningsord position 6"), {
    target: { value: "T" }
  });

  expect(screen.getByLabelText("Lösningsord position 6")).toHaveValue("T");
});

test("Skicka calls onSubmit with submission payload", () => {
  const onSubmit = jest.fn();

  render(<SubmissionDialog onClose={() => {}} onSubmit={onSubmit} />);

  fireEvent.paste(screen.getByLabelText("Lösningsord position 1"), {
    clipboardData: {
      getData: () => "ABCDEF"
    }
  });
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
    solution: "ABCDEF",
    name: "Fredrik",
    email: "fredrik@example.com",
    phone: "0701234567"
  });
});

test("shows loading state and prevents submit while submitting", () => {
  render(
    <SubmissionDialog
      isSubmitting
      onClose={() => {}}
      onSubmit={() => {}}
    />
  );

  fireEvent.change(screen.getByLabelText("Namn *"), {
    target: { value: "Fredrik" }
  });
  fireEvent.change(screen.getByLabelText("E-post *"), {
    target: { value: "fredrik@example.com" }
  });
  fireEvent.change(screen.getByLabelText("Telefonnummer *"), {
    target: { value: "0701234567" }
  });

  expect(screen.getByRole("button", { name: "Skickar..." })).toBeDisabled();
});

test("shows submission error message", () => {
  render(
    <SubmissionDialog
      errorMessage="Det gick inte att skicka tävlingsbidraget."
      onClose={() => {}}
      onSubmit={() => {}}
    />
  );

  expect(screen.getByRole("alert")).toHaveTextContent(
    "Det gick inte att skicka tävlingsbidraget."
  );
});

test("shows success message and disables submit", () => {
  render(
    <SubmissionDialog
      successMessage="Ditt tävlingsbidrag har skickats in."
      onClose={() => {}}
      onSubmit={() => {}}
    />
  );

  fireEvent.change(screen.getByLabelText("Namn *"), {
    target: { value: "Fredrik" }
  });
  fireEvent.change(screen.getByLabelText("E-post *"), {
    target: { value: "fredrik@example.com" }
  });
  fireEvent.change(screen.getByLabelText("Telefonnummer *"), {
    target: { value: "0701234567" }
  });

  expect(screen.getByRole("status")).toHaveTextContent(
    "Ditt tävlingsbidrag har skickats in."
  );
  expect(screen.getByRole("button", { name: "Skicka" })).toBeDisabled();
});
