import { render, screen, waitFor } from "@testing-library/react";
import Play from "./Play";
import PlaySurface from "./play/PlaySurface";
import { loadBackendTemplate } from "./template/templateApi";

jest.mock("react-router-dom", () => ({
  useParams: () => ({
    id: "missing-template"
  })
}), { virtual: true });

jest.mock("./template/templateApi", () => ({
  loadBackendTemplate: jest.fn()
}));

jest.mock("./play/PlaySurface", () => {
  const React = require("react");

  return jest.fn(({
    template,
    responsive = false,
    onSubmitAnswers
  }) => React.createElement(
    "button",
    {
      type: "button",
      "data-testid": "play-surface",
      "data-responsive": responsive ? "true" : "false",
      onClick: onSubmitAnswers
    },
    template.crosswordId
  ));
});

afterEach(() => {
  jest.clearAllMocks();
});

test("network/load failure produces the Public Play error state", async () => {
  loadBackendTemplate.mockRejectedValue(new Error("Template not found"));

  render(<Play />);

  expect(screen.getByText("Loading...")).toBeInTheDocument();

  await waitFor(() => {
    expect(
      screen.getByText("Could not load template: Template not found")
    ).toBeInTheDocument();
  });
});

test("Public Play remains cropped and responsive", async () => {
  loadBackendTemplate.mockResolvedValue({
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
  });

  render(<Play />);

  await waitFor(() => {
    expect(PlaySurface).toHaveBeenCalled();
  });

  expect(PlaySurface).toHaveBeenCalledWith(
    expect.objectContaining({
      responsive: true,
      template: expect.objectContaining({
        cropArea: {
          top: 100,
          left: 80,
          width: 900,
          height: 700
        }
      })
    }),
    undefined
  );
});
