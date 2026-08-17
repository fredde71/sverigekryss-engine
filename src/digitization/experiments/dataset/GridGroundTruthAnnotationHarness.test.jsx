import fs from "fs";
import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import GridGroundTruthAnnotationHarness from "./GridGroundTruthAnnotationHarness";
import { GRID_GROUND_TRUTH_COORDINATE_POLICY } from "./gridGroundTruth";

jest.mock("pdfjs-dist", () => ({
  getDocument: jest.fn()
}));

test("renders only in development and test", () => {
  const prepareInput = jest.fn();
  const production = render(
    <GridGroundTruthAnnotationHarness
      datasetId="dataset"
      items={createItems()}
      prepareInput={prepareInput}
      readEnvironment={() => "production"}
    />
  );

  expect(production.container).toBeEmptyDOMElement();
  expect(prepareInput).not.toHaveBeenCalled();
  production.unmount();

  const remoteDevelopment = render(
    <GridGroundTruthAnnotationHarness
      datasetId="dataset"
      items={createItems()}
      prepareInput={prepareInput}
      readEnvironment={() => "development"}
      readHostname={() => "example.com"}
    />
  );
  expect(remoteDevelopment.container).toBeEmptyDOMElement();
  remoteDevelopment.unmount();

  render(
    <GridGroundTruthAnnotationHarness
      datasetId="dataset"
      items={createItems()}
      prepareInput={prepareInput}
      readEnvironment={() => "development"}
    />
  );
  expect(screen.getByRole("region", {
    name: "Grid ground truth annotation"
  })).toBeInTheDocument();
});

test("keeps hook order stable when the environment guard changes", () => {
  const props = {
    datasetId: "dataset",
    items: createItems(),
    readHostname: () => "localhost"
  };
  const { container, rerender } = render(
    <GridGroundTruthAnnotationHarness
      {...props}
      readEnvironment={() => "production"}
    />
  );

  expect(container).toBeEmptyDOMElement();

  rerender(
    <GridGroundTruthAnnotationHarness
      {...props}
      readEnvironment={() => "test"}
    />
  );

  expect(screen.getByRole("region", {
    name: "Grid ground truth annotation"
  })).toBeInTheDocument();
});

test("selects a dataset item and renders it through the existing PDF adapter boundary only", async () => {
  const source = createCanvas();
  const readImageData = jest.fn();
  const prepareInput = jest.fn(async item => ({ source, readImageData }));

  renderHarness({ prepareInput });
  fireEvent.change(screen.getByLabelText("Dataset item"), {
    target: { value: "item-002" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Render selected PDF" }));

  await screen.findByLabelText("Rendered PDF page 1 at scale 2");
  expect(prepareInput).toHaveBeenCalledTimes(1);
  expect(prepareInput).toHaveBeenCalledWith(createItems()[1]);
  expect(readImageData).not.toHaveBeenCalled();
  expect(screen.getByTestId("ground-truth-surface")).toContainElement(source);
});

test("creates draft handles but exports only after explicit human confirmation", async () => {
  const onGroundTruthChange = jest.fn();

  renderHarness({ onGroundTruthChange });
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  expect(screen.getByRole("slider", { name: "Top boundary handle" }))
    .toHaveAttribute("aria-valuenow", "10");
  expect(screen.getByRole("slider", { name: "Bottom boundary handle" }))
    .toHaveAttribute("aria-valuenow", "30");
  expect(screen.getByRole("slider", { name: "Left boundary handle" }))
    .toHaveAttribute("aria-valuenow", "5");
  expect(screen.getByRole("slider", { name: "Right boundary handle" }))
    .toHaveAttribute("aria-valuenow", "25");
  fireEvent.change(screen.getByLabelText("Rows"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Columns"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Generate draft line handles" }));

  expect(screen.getAllByRole("slider", { name: /Horizontal line/ })).toHaveLength(3);
  expect(screen.getAllByRole("slider", { name: /Vertical line/ })).toHaveLength(3);
  expect(onGroundTruthChange).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", {
    name: "Download ground truth JSON"
  })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", {
    name: "Confirm ground truth for selected item"
  }));

  await waitFor(() => expect(onGroundTruthChange).toHaveBeenCalledTimes(1));
  const groundTruth = onGroundTruthChange.mock.calls[0][0];

  expect(groundTruth).toEqual(expect.objectContaining({
    type: "digitization-grid-ground-truth",
    version: 1,
    datasetId: "dataset"
  }));
  expect(groundTruth.annotations).toEqual([
    expect.objectContaining({
      itemId: "item-001",
      filename: "one.pdf",
      document: { width: 100, height: 120 },
      gridBounds: { top: 10, left: 5, width: 20, height: 20 },
      horizontalLinePositions: [10, 20, 30],
      verticalLinePositions: [5, 15, 25],
      rows: 2,
      cols: 2,
      annotation: {
        status: "human-confirmed",
        method: "visual-line-handles",
        interpolationUsedForDraft: true
      }
    })
  ]);
  expect(screen.getByRole("button", {
    name: "Download ground truth JSON"
  })).toBeInTheDocument();
});

test("supports drag movement and half-pixel keyboard movement", async () => {
  renderHarness();
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();

  const horizontal = screen.getByRole("slider", { name: "Horizontal line 2" });
  fireEvent.mouseDown(horizontal);
  fireEvent.mouseMove(screen.getByTestId("ground-truth-surface"), {
    clientX: 0,
    clientY: 21.5
  });
  fireEvent.mouseUp(screen.getByTestId("ground-truth-surface"));
  expect(screen.getByRole("slider", { name: "Horizontal line 2" }))
    .toHaveAttribute("aria-valuenow", "21");
  fireEvent.keyDown(screen.getByRole("slider", { name: "Horizontal line 2" }), {
    key: "ArrowDown"
  });
  expect(screen.getByRole("slider", { name: "Horizontal line 2" }))
    .toHaveAttribute("aria-valuenow", "21.5");

  const vertical = screen.getByRole("slider", { name: "Vertical line 2" });
  fireEvent.keyDown(vertical, { key: "ArrowRight" });
  expect(screen.getByRole("slider", { name: "Vertical line 2" }))
    .toHaveAttribute("aria-valuenow", "15.5");
});

test("allows lines to be added and removed while keeping counts explicit", async () => {
  renderHarness();
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();

  fireEvent.click(screen.getByRole("button", { name: "Add horizontal line" }));
  fireEvent.click(screen.getByTestId("ground-truth-surface"), {
    clientX: 10,
    clientY: 25
  });
  expect(screen.getAllByRole("slider", { name: /Horizontal line/ })).toHaveLength(4);
  expect(screen.getByLabelText("Rows")).toHaveValue(3);

  fireEvent.click(screen.getByRole("button", {
    name: "Remove horizontal line 3"
  }));
  expect(screen.getAllByRole("slider", { name: /Horizontal line/ })).toHaveLength(3);
  expect(screen.getByLabelText("Rows")).toHaveValue(2);
});

test("supports zoom without changing confirmed coordinates", async () => {
  const onGroundTruthChange = jest.fn();

  renderHarness({ onGroundTruthChange });
  await renderPdf();
  expect(screen.getByLabelText("Annotation zoom")).toHaveTextContent("100%");
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(screen.getByLabelText("Annotation zoom")).toHaveTextContent("125%");
  fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
  expect(screen.getByLabelText("Annotation zoom")).toHaveTextContent("100%");

  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();
  fireEvent.click(screen.getByRole("button", {
    name: "Confirm ground truth for selected item"
  }));

  expect(onGroundTruthChange.mock.calls[0][0].annotations[0].gridBounds)
    .toEqual({ top: 10, left: 5, width: 20, height: 20 });
});

test("keeps shadow overlays hidden until confirmation and an explicit opt-in", async () => {
  const validationReport = createValidationReport();

  renderHarness({ validationReport });
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();

  expect(screen.queryByLabelText("Show experimental shadow overlay"))
    .not.toBeInTheDocument();
  expect(screen.queryByTestId("shadow-horizontal-overlay")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", {
    name: "Confirm ground truth for selected item"
  }));
  const toggle = screen.getByLabelText("Show experimental shadow overlay");

  expect(screen.queryByTestId("shadow-horizontal-overlay")).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(screen.getAllByTestId("shadow-horizontal-overlay")).toHaveLength(3);
  expect(screen.getAllByTestId("shadow-vertical-overlay")).toHaveLength(3);
  expect(screen.getByLabelText("Shadow grid comparison")).toBeInTheDocument();
});

test("downloads the exact confirmed ground-truth artifact", async () => {
  const downloadGroundTruth = jest.fn();
  const onGroundTruthChange = jest.fn();

  renderHarness({ downloadGroundTruth, onGroundTruthChange });
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();
  fireEvent.click(screen.getByRole("button", {
    name: "Confirm ground truth for selected item"
  }));
  const artifact = onGroundTruthChange.mock.calls[0][0];
  fireEvent.click(screen.getByRole("button", {
    name: "Download ground truth JSON"
  }));

  expect(downloadGroundTruth).toHaveBeenCalledTimes(1);
  expect(downloadGroundTruth).toHaveBeenCalledWith(artifact);
});

test("loads a confirmed ground-truth artifact without rendering or detection", async () => {
  const onGroundTruthChange = jest.fn();
  const prepareInput = jest.fn();
  const artifact = {
    type: "digitization-grid-ground-truth",
    version: 1,
    datasetId: "dataset",
    coordinatePolicy: GRID_GROUND_TRUTH_COORDINATE_POLICY,
    annotations: [
      {
        itemId: "item-001",
        filename: "one.pdf",
        document: { width: 100, height: 120 },
        gridBounds: { top: 10, left: 5, width: 20, height: 20 },
        horizontalLinePositions: [10, 20, 30],
        verticalLinePositions: [5, 15, 25],
        rows: 2,
        cols: 2,
        annotation: { status: "human-confirmed" }
      }
    ]
  };
  const file = {
    name: "ground-truth.json",
    text: jest.fn(async () => JSON.stringify(artifact))
  };

  renderHarness({ onGroundTruthChange, prepareInput });
  fireEvent.change(screen.getByLabelText("Load ground truth JSON"), {
    target: { files: [file] }
  });

  await waitFor(() => expect(onGroundTruthChange).toHaveBeenCalledTimes(1));
  expect(onGroundTruthChange.mock.calls[0][0]).toEqual(expect.objectContaining({
    type: "digitization-grid-ground-truth",
    datasetId: "dataset"
  }));
  expect(file.text).toHaveBeenCalledTimes(1);
  expect(prepareInput).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Download ground truth JSON" }))
    .toBeInTheDocument();
});

test("does not import or invoke production detection, experiments, or persistence", () => {
  const source = fs.readFileSync(
    require.resolve("./GridGroundTruthAnnotationHarness"),
    "utf8"
  );

  expect(source).not.toMatch(/detectGrid|runDigitizationExperiment|runDataset/);
  expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  expect(source).not.toMatch(/score|rank|recommendation|preferredRegion|selectedRegion/);
});

function renderHarness(props = {}) {
  return render(
    <GridGroundTruthAnnotationHarness
      datasetId="dataset"
      items={createItems()}
      prepareInput={async () => ({ source: createCanvas() })}
      {...props}
    />
  );
}

async function renderPdf() {
  fireEvent.click(screen.getByRole("button", { name: "Render selected PDF" }));
  await screen.findByLabelText("Rendered PDF page 1 at scale 2");
}

function placeBoundaries({ top, bottom, left, right }) {
  const surface = screen.getByTestId("ground-truth-surface");

  for (const [name, x, y] of [
    ["top", 0, top],
    ["bottom", 0, bottom],
    ["left", left, 0],
    ["right", right, 0]
  ]) {
    fireEvent.click(screen.getByRole("button", {
      name: `Place ${name} boundary`
    }));
    fireEvent.click(surface, { clientX: x, clientY: y });
  }
}

function setCountsAndGenerate() {
  fireEvent.change(screen.getByLabelText("Rows"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Columns"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Generate draft line handles" }));
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 120;
  return canvas;
}

function createItems() {
  return [
    {
      id: "item-001",
      input: { kind: "pdf", file: { name: "one.pdf" } },
      metadata: { filename: "one.pdf" }
    },
    {
      id: "item-002",
      input: { kind: "pdf", file: { name: "two.pdf" } },
      metadata: { filename: "two.pdf" }
    }
  ];
}

function createValidationReport() {
  return {
    type: "shadow-grid-validation-report",
    version: 1,
    datasetId: "dataset",
    status: "complete",
    items: [
      {
        itemId: "item-001",
        comparisons: [
          {
            normalizedObservation: {
              candidatePositions: {
                horizontal: [10, 20, 30],
                vertical: [5, 15, 25]
              }
            }
          }
        ]
      }
    ]
  };
}
