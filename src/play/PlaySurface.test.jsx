import { fireEvent, render, screen } from "@testing-library/react";
import PlaySurface from "./PlaySurface";

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

  return function MockRuntimeLayer() {
    return React.createElement("div", {
      "data-testid": "runtime-layer"
    });
  };
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

test("button calls onSubmitAnswers", () => {
  const onSubmitAnswers = jest.fn();

  render(
    <PlaySurface template={template} onSubmitAnswers={onSubmitAnswers} />
  );

  fireEvent.click(screen.getByRole("button", { name: "Skicka in svar" }));

  expect(onSubmitAnswers).toHaveBeenCalledTimes(1);
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
