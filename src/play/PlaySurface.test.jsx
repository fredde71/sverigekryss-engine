import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PlaySurface from "./PlaySurface";
import { submitCompetitionEntry } from "../template/templateApi";

jest.mock("../template/templateApi", () => ({
  submitCompetitionEntry: jest.fn()
}));

jest.mock("../template/TemplateCanvas", () => {
  const React = require("react");

  return function MockTemplateCanvas({
    responsive = false,
    cropped = responsive,
    children
  }) {
    return React.createElement(
      "div",
      {
        "data-testid": "template-canvas-viewport",
        "data-responsive": responsive ? "true" : "false",
        "data-cropped": cropped ? "true" : "false"
      },
      children
    );
  };
});

jest.mock("../runtime/RuntimeLayer", () => {
  const React = require("react");

  return function MockRuntimeLayer({ onAnswersChange }) {
    return React.createElement(
      "button",
      {
        type: "button",
        "data-testid": "runtime-layer",
        onClick: () => onAnswersChange({
          1: "B",
          2: "A",
          3: "R",
          4: "D",
          5: "E",
          6: "N"
        })
      },
      "Runtime"
    );
  };
});

beforeEach(() => {
  submitCompetitionEntry.mockReset();
});

const template = {
  crosswordId: "TT-2026-0001",
  rows: 1,
  cols: 1,
  cellTypes: ["write"],
  imageSrc: "/grid.png",
  documentSize: {
    width: 1200,
    height: 1697
  },
  cropArea: {
    top: 100,
    left: 80,
    width: 900,
    height: 700
  },
  gridArea: {
    top: 100,
    left: 80,
    width: 900,
    height: 700
  }
};

test("renders submit button below and outside TemplateCanvas viewport", () => {
  render(<PlaySurface template={template} onSubmitAnswers={() => {}} />);

  const viewport = screen.getByTestId("template-canvas-viewport");
  const button = screen.getByRole("button", { name: "Skicka in svar" });

  expect(viewport).not.toContainElement(button);
  expect(screen.getByTestId("play-surface")).toContainElement(button);
});

test("button opens submission dialog", () => {
  const onSubmitAnswers = jest.fn();

  render(
    <PlaySurface template={template} onSubmitAnswers={onSubmitAnswers} />
  );

  fireEvent.click(screen.getByRole("button", { name: "Skicka in svar" }));

  expect(
    screen.getByRole("dialog", { name: "Skicka in tävlingsbidrag" })
  ).toBeInTheDocument();
  expect(onSubmitAnswers).not.toHaveBeenCalled();
});

test("submission dialog posts valid payload with templateId", async () => {
  const onSubmitAnswers = jest.fn();
  submitCompetitionEntry.mockResolvedValue({
    success: true
  });

  render(
    <PlaySurface template={template} onSubmitAnswers={onSubmitAnswers} />
  );

  fireEvent.click(screen.getByRole("button", { name: "Skicka in svar" }));
  fireEvent.change(screen.getByLabelText("Namn *"), {
    target: { value: "Fredrik" }
  });
  fireEvent.change(screen.getByLabelText("E-post *"), {
    target: { value: "fredrik@example.com" }
  });
  fireEvent.change(screen.getByLabelText("Telefonnummer *"), {
    target: { value: "0701234567" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Skicka" }));

  await waitFor(() => {
    expect(submitCompetitionEntry).toHaveBeenCalledWith({
      templateId: "TT-2026-0001",
      solution: "      ",
      name: "Fredrik",
      email: "fredrik@example.com",
      phone: "0701234567"
    });
  });
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Ditt tävlingsbidrag har skickats in."
  );
  expect(onSubmitAnswers).toHaveBeenCalledWith({
    solution: "      ",
    name: "Fredrik",
    email: "fredrik@example.com",
    phone: "0701234567"
  });
});

test("autofills a complete competition word from Runtime answers", () => {
  const onSubmitAnswers = jest.fn();

  render(
    <PlaySurface
      template={{
        ...template,
        competitionCells: [
          { number: 1, index: 2 },
          { number: 2, index: 1 },
          { number: 3, index: 4 },
          { number: 4, index: 3 },
          { number: 5, index: 6 },
          { number: 6, index: 5 }
        ]
      }}
      onSubmitAnswers={onSubmitAnswers}
    />
  );

  fireEvent.click(screen.getByTestId("runtime-layer"));
  fireEvent.click(screen.getByRole("button", { name: "Skicka in svar" }));

  expect(screen.getByLabelText("Lösningsord position 1")).toHaveValue("A");
  expect(screen.getByLabelText("Lösningsord position 2")).toHaveValue("B");
  expect(screen.getByLabelText("Lösningsord position 6")).toHaveValue("E");
});

test("autofills partial competition words and leaves missing cells blank", () => {
  render(
    <PlaySurface
      template={{
        ...template,
        competitionCells: [
          { number: 1, index: 2 },
          { number: 3, index: 3 }
        ]
      }}
      onSubmitAnswers={() => {}}
    />
  );

  fireEvent.click(screen.getByTestId("runtime-layer"));
  fireEvent.click(screen.getByRole("button", { name: "Skicka in svar" }));

  expect(screen.getByLabelText("Lösningsord position 1")).toHaveValue("A");
  expect(screen.getByLabelText("Lösningsord position 2")).toHaveValue("");
  expect(screen.getByLabelText("Lösningsord position 3")).toHaveValue("R");
});

test("manual edits override autofilled letters", async () => {
  const onSubmitAnswers = jest.fn();
  submitCompetitionEntry.mockResolvedValue({
    success: true
  });

  render(
    <PlaySurface
      template={{
        ...template,
        competitionCells: [
          { number: 1, index: 2 },
          { number: 2, index: 1 }
        ]
      }}
      onSubmitAnswers={onSubmitAnswers}
    />
  );

  fireEvent.click(screen.getByTestId("runtime-layer"));
  fireEvent.click(screen.getByRole("button", { name: "Skicka in svar" }));
  fireEvent.change(screen.getByLabelText("Lösningsord position 1"), {
    target: { value: "X" }
  });
  fireEvent.change(screen.getByLabelText("Namn *"), {
    target: { value: "Fredrik" }
  });
  fireEvent.change(screen.getByLabelText("E-post *"), {
    target: { value: "fredrik@example.com" }
  });
  fireEvent.change(screen.getByLabelText("Telefonnummer *"), {
    target: { value: "0701234567" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Skicka" }));

  await waitFor(() => {
    expect(submitCompetitionEntry).toHaveBeenCalledWith(expect.objectContaining({
      solution: "XB    "
    }));
  });
  expect(onSubmitAnswers).toHaveBeenCalledWith(expect.objectContaining({
    solution: "XB    "
  }));
});

test("prevents double submission while request is loading", async () => {
  let resolveSubmission;
  submitCompetitionEntry.mockReturnValue(new Promise(resolve => {
    resolveSubmission = resolve;
  }));

  render(<PlaySurface template={template} onSubmitAnswers={() => {}} />);

  openValidSubmissionDialog();
  const submitButton = screen.getByRole("button", { name: "Skicka" });

  fireEvent.click(submitButton);
  fireEvent.click(submitButton);

  expect(screen.getByRole("button", { name: "Skickar..." })).toBeDisabled();
  expect(submitCompetitionEntry).toHaveBeenCalledTimes(1);

  resolveSubmission({
    success: true
  });

  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ditt tävlingsbidrag har skickats in."
    );
  });
});

test("keeps dialog open and shows error when submission fails", async () => {
  submitCompetitionEntry.mockRejectedValue(new Error("Invalid solution"));

  render(<PlaySurface template={template} onSubmitAnswers={() => {}} />);

  openValidSubmissionDialog();
  fireEvent.click(screen.getByRole("button", { name: "Skicka" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid solution"
  );
  expect(
    screen.getByRole("dialog", { name: "Skicka in tävlingsbidrag" })
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Skicka" })).toBeEnabled();
});

test("local PlaySurface mode is cropped without responsive mode", () => {
  render(<PlaySurface template={template} onSubmitAnswers={() => {}} />);

  expect(screen.getByTestId("template-canvas-viewport")).toHaveAttribute(
    "data-cropped",
    "true"
  );
  expect(screen.getByTestId("template-canvas-viewport")).toHaveAttribute(
    "data-responsive",
    "false"
  );
});

test("public PlaySurface mode is responsive and cropped", () => {
  render(
    <PlaySurface
      template={template}
      responsive
      onSubmitAnswers={() => {}}
    />
  );

  expect(screen.getByTestId("template-canvas-viewport")).toHaveAttribute(
    "data-cropped",
    "true"
  );
  expect(screen.getByTestId("template-canvas-viewport")).toHaveAttribute(
    "data-responsive",
    "true"
  );
});

function openValidSubmissionDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Skicka in svar" }));
  fireEvent.change(screen.getByLabelText("Namn *"), {
    target: { value: "Fredrik" }
  });
  fireEvent.change(screen.getByLabelText("E-post *"), {
    target: { value: "fredrik@example.com" }
  });
  fireEvent.change(screen.getByLabelText("Telefonnummer *"), {
    target: { value: "0701234567" }
  });
}
