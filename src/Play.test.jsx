import { render, screen, waitFor } from "@testing-library/react";
import Play from "./Play";
import TemplateCanvas from "./template/TemplateCanvas";
import { loadBackendTemplate } from "./template/templateApi";

jest.mock("react-router-dom", () => ({
  useParams: () => ({
    id: "missing-template"
  })
}), { virtual: true });

jest.mock("./template/templateApi", () => ({
  loadBackendTemplate: jest.fn()
}));

jest.mock("./template/TemplateCanvas", () => {
  const React = require("react");

  return jest.fn(({
    responsive = false,
    cropped = responsive,
    children
  }) => React.createElement(
    "div",
    {
      "data-testid": "public-template-canvas",
      "data-responsive": responsive ? "true" : "false",
      "data-cropped": cropped ? "true" : "false"
    },
    children
  ));
});

jest.mock("./runtime/RuntimeLayer", () => {
  const React = require("react");

  return function MockRuntimeLayer() {
    return React.createElement("div", {
      "data-testid": "runtime-layer"
    });
  };
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
    expect(TemplateCanvas).toHaveBeenCalled();
  });

  expect(TemplateCanvas).toHaveBeenCalledWith(
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
