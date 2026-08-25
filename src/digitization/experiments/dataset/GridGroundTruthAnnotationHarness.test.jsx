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

  await screen.findByLabelText("Rendered PDF page 1 at scale 2");
  expect(prepareInput).toHaveBeenCalledTimes(1);
  expect(prepareInput).toHaveBeenCalledWith(createItems()[1]);
  expect(readImageData).not.toHaveBeenCalled();
  expect(screen.getByTestId("ground-truth-surface")).toContainElement(source);
});

test("shows annotation status for every dataset document and the active target", () => {
  renderHarness();

  expect(screen.getByLabelText("item-001 annotation status"))
    .toHaveTextContent("not annotated");
  expect(screen.getByLabelText("item-002 annotation status"))
    .toHaveTextContent("not annotated");
  expect(screen.getByLabelText("item-001 active annotation target"))
    .toHaveTextContent("active");
  expect(screen.queryByLabelText("item-002 active annotation target"))
    .not.toBeInTheDocument();
});

test("annotates two documents independently and exports annotations in dataset order", async () => {
  const onGroundTruthChange = jest.fn();
  const prepareInput = jest.fn(async () => ({ source: createCanvas() }));

  renderHarness({ onGroundTruthChange, prepareInput });
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();
  fireEvent.click(screen.getByRole("button", {
    name: "Confirm ground truth for selected item"
  }));

  expect(screen.getByLabelText("item-001 annotation status"))
    .toHaveTextContent("annotated");
  expect(screen.getByLabelText("item-002 annotation status"))
    .toHaveTextContent("not annotated");

  fireEvent.click(screen.getByRole("button", {
    name: "Close annotation workspace"
  }));
  fireEvent.change(screen.getByLabelText("Dataset item"), {
    target: { value: "item-002" }
  });
  const secondWorkspace = await screen.findByRole("dialog", {
    name: "Grid ground truth annotation workspace"
  });

  expect(secondWorkspace).toHaveTextContent("two.pdf");
  expect(screen.getByLabelText("item-002 active annotation target"))
    .toHaveTextContent("active");
  placeBoundaries({ top: 40, bottom: 60, left: 30, right: 50 });
  setCountsAndGenerate();
  fireEvent.click(screen.getByRole("button", {
    name: "Confirm ground truth for selected item"
  }));

  const artifact = onGroundTruthChange.mock.calls[1][0];

  expect(artifact.annotations).toEqual([
    expect.objectContaining({
      itemId: "item-001",
      filename: "one.pdf",
      gridBounds: { top: 10, left: 5, width: 20, height: 20 },
      horizontalLinePositions: [10, 20, 30],
      verticalLinePositions: [5, 15, 25]
    }),
    expect.objectContaining({
      itemId: "item-002",
      filename: "two.pdf",
      gridBounds: { top: 40, left: 30, width: 20, height: 20 },
      horizontalLinePositions: [40, 50, 60],
      verticalLinePositions: [30, 40, 50]
    })
  ]);
  expect(screen.getByLabelText("item-001 annotation status"))
    .toHaveTextContent("annotated");
  expect(screen.getByLabelText("item-002 annotation status"))
    .toHaveTextContent("annotated");

  fireEvent.click(screen.getByRole("button", {
    name: "Close annotation workspace"
  }));
  fireEvent.change(screen.getByLabelText("Dataset item"), {
    target: { value: "item-001" }
  });
  await screen.findByRole("dialog", {
    name: "Grid ground truth annotation workspace"
  });

  expect(screen.getByRole("slider", { name: "Horizontal line 2" }))
    .toHaveAttribute("aria-valuenow", "20");
  expect(screen.getByRole("slider", { name: "Vertical line 2" }))
    .toHaveAttribute("aria-valuenow", "15");
  expect(prepareInput).toHaveBeenCalledTimes(2);
});

test("preserves an unconfirmed draft independently while switching documents", async () => {
  const onGroundTruthChange = jest.fn();

  renderHarness({ onGroundTruthChange });
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();
  fireEvent.click(screen.getByRole("button", {
    name: "Close annotation workspace"
  }));

  fireEvent.change(screen.getByLabelText("Dataset item"), {
    target: { value: "item-002" }
  });
  await screen.findByRole("dialog", {
    name: "Grid ground truth annotation workspace"
  });
  expect(screen.queryByRole("slider", { name: "Horizontal line 2" }))
    .not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {
    name: "Close annotation workspace"
  }));

  fireEvent.change(screen.getByLabelText("Dataset item"), {
    target: { value: "item-001" }
  });
  await screen.findByRole("dialog", {
    name: "Grid ground truth annotation workspace"
  });
  expect(screen.getByRole("slider", { name: "Horizontal line 2" }))
    .toHaveAttribute("aria-valuenow", "20");
  expect(screen.getByRole("slider", { name: "Vertical line 2" }))
    .toHaveAttribute("aria-valuenow", "15");
  expect(onGroundTruthChange).not.toHaveBeenCalled();
});

test("copies confirmed geometry to another item as an unconfirmed draft", async () => {
  const onGroundTruthChange = jest.fn();

  renderHarness({ onGroundTruthChange });
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();
  fireEvent.click(screen.getByRole("button", {
    name: "Confirm ground truth for selected item"
  }));
  expect(onGroundTruthChange).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", {
    name: "Close annotation workspace"
  }));
  fireEvent.change(screen.getByLabelText("Dataset item"), {
    target: { value: "item-002" }
  });
  await screen.findByRole("dialog", {
    name: "Grid ground truth annotation workspace"
  });

  const source = screen.getByLabelText("Copy confirmed annotation from");
  const copy = screen.getByRole("button", {
    name: "Copy confirmed annotation to selected draft"
  });

  expect(source).toBeEnabled();
  expect(source).toHaveValue("item-001");
  expect(copy).toBeEnabled();
  fireEvent.click(copy);

  expect(screen.getByRole("slider", { name: "Horizontal line 2" }))
    .toHaveAttribute("aria-valuenow", "20");
  expect(screen.getByRole("slider", { name: "Vertical line 2" }))
    .toHaveAttribute("aria-valuenow", "15");
  expect(screen.getByLabelText("item-002 annotation status"))
    .toHaveTextContent("not annotated");
  expect(screen.getByText("Ground truth not confirmed for item-002"))
    .toBeInTheDocument();
  expect(onGroundTruthChange).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", {
    name: "Confirm ground truth for selected item"
  }));
  expect(onGroundTruthChange).toHaveBeenCalledTimes(2);
  expect(onGroundTruthChange.mock.calls[1][0].annotations).toEqual([
    expect.objectContaining({
      itemId: "item-001",
      filename: "one.pdf",
      horizontalLinePositions: [10, 20, 30],
      verticalLinePositions: [5, 15, 25]
    }),
    expect.objectContaining({
      itemId: "item-002",
      filename: "two.pdf",
      horizontalLinePositions: [10, 20, 30],
      verticalLinePositions: [5, 15, 25],
      annotation: expect.objectContaining({ status: "human-confirmed" })
    })
  ]);
  expect(copy).toBeDisabled();
  fireEvent.click(copy);
  expect(onGroundTruthChange).toHaveBeenCalledTimes(2);
});

test("does not offer the selected confirmed annotation as a copy source", async () => {
  renderHarness();
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();
  fireEvent.click(screen.getByRole("button", {
    name: "Confirm ground truth for selected item"
  }));

  expect(screen.getByLabelText("Copy confirmed annotation from")).toBeDisabled();
  expect(screen.getByRole("button", {
    name: "Copy confirmed annotation to selected draft"
  })).toBeDisabled();
  expect(screen.getByLabelText("Copy confirmed annotation from"))
    .toHaveTextContent("No confirmed source available");
});

test("opens the PDF in a full-workspace portal with a compact toolbar", async () => {
  renderHarness();
  await renderPdf();

  const workspace = screen.getByRole("dialog", {
    name: "Grid ground truth annotation workspace"
  });
  const annotationSection = screen.getByRole("region", {
    name: "Grid ground truth annotation"
  });

  expect(workspace.parentElement).toBe(document.body);
  expect(annotationSection).not.toContainElement(workspace);
  expect(screen.getByRole("toolbar", {
    name: "Grid annotation tools"
  })).toBeInTheDocument();
  expect(screen.getByLabelText("PDF annotation viewport")).toContainElement(
    screen.getByLabelText("Rendered PDF page 1 at scale 2")
  );

  fireEvent.click(screen.getByRole("button", {
    name: "Close annotation workspace"
  }));
  expect(screen.queryByRole("dialog", {
    name: "Grid ground truth annotation workspace"
  })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", {
    name: "Open annotation workspace"
  }));
  expect(screen.getByLabelText("Rendered PDF page 1 at scale 2"))
    .toContainElement(screen.getByTestId("ground-truth-surface").querySelector("canvas"));
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
    name: "Download grid ground-truth JSON"
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
    name: "Download grid ground-truth JSON"
  })).toBeInTheDocument();
  expect(screen.getByLabelText("Annotation item status"))
    .toHaveTextContent("Ground truth confirmed for item-001");
});

test("uses color-only selection without changing the precise line thickness", async () => {
  renderHarness();
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();

  const horizontal = screen.getByRole("slider", { name: "Horizontal line 2" });
  const horizontalStroke = horizontal.querySelector("span");
  const unselectedHorizontalColor = horizontalStroke.style.background;

  expect(horizontal).toHaveStyle({ height: "12px" });
  expect(horizontalStroke).toHaveStyle({ height: "2px", top: "5px" });

  fireEvent.click(horizontal);

  expect(horizontal).toHaveAttribute("data-selected", "true");
  expect(horizontal.querySelector("span")).toHaveStyle({
    height: "2px",
    top: "5px"
  });
  expect(horizontal.querySelector("span").style.background)
    .not.toBe(unselectedHorizontalColor);

  const vertical = screen.getByRole("slider", { name: "Vertical line 2" });
  const verticalStroke = vertical.querySelector("span");

  expect(vertical).toHaveStyle({ width: "12px" });
  expect(verticalStroke).toHaveStyle({ width: "2px", left: "5px" });

  fireEvent.click(vertical);

  expect(vertical).toHaveAttribute("data-selected", "true");
  expect(vertical.querySelector("span")).toHaveStyle({
    width: "2px",
    left: "5px"
  });
  expect(screen.getByLabelText("Selected grid line"))
    .toHaveTextContent("Vertical line 2 at 15px");
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
  fireEvent.click(vertical);
  expect(vertical).toHaveAttribute("data-selected", "true");
  expect(screen.getByLabelText("Selected grid line"))
    .toHaveTextContent("Vertical line 2 at 15px");
  fireEvent.keyDown(vertical, { key: "ArrowRight" });
  expect(screen.getByRole("slider", { name: "Vertical line 2" }))
    .toHaveAttribute("aria-valuenow", "15.5");
});

test("requires line selection before Delete or Backspace removes a line", async () => {
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
  expect(screen.queryByRole("button", { name: /Remove horizontal line/ }))
    .not.toBeInTheDocument();

  fireEvent.keyDown(screen.getByRole("slider", { name: "Horizontal line 2" }), {
    key: "Delete"
  });
  expect(screen.getAllByRole("slider", { name: /Horizontal line/ })).toHaveLength(4);

  const selected = screen.getByRole("slider", { name: "Horizontal line 3" });
  expect(selected).toHaveAttribute("data-selected", "true");
  fireEvent.keyDown(selected, { key: "Backspace" });
  expect(screen.getAllByRole("slider", { name: /Horizontal line/ })).toHaveLength(3);
  expect(screen.getByLabelText("Rows")).toHaveValue(2);
  expect(screen.getByLabelText("Selected grid line"))
    .toHaveTextContent("No line selected");

  fireEvent.click(screen.getByRole("slider", { name: "Horizontal line 2" }));
  fireEvent.keyDown(screen.getByRole("slider", { name: "Horizontal line 2" }), {
    key: "Delete"
  });
  expect(screen.getAllByRole("slider", { name: /Horizontal line/ })).toHaveLength(2);
  expect(screen.getByLabelText("Rows")).toHaveValue(1);
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

test("pans the zoomed workspace without changing line coordinates", async () => {
  renderHarness();
  await renderPdf();
  placeBoundaries({ top: 10, bottom: 30, left: 5, right: 25 });
  setCountsAndGenerate();
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

  const viewport = screen.getByLabelText("PDF annotation viewport");
  viewport.scrollLeft = 40;
  viewport.scrollTop = 50;
  fireEvent.click(screen.getByRole("button", { name: "Pan workspace" }));
  fireEvent.mouseDown(viewport, { clientX: 100, clientY: 100 });
  fireEvent.mouseMove(viewport, { clientX: 70, clientY: 60 });
  fireEvent.mouseUp(viewport);

  expect(viewport.scrollLeft).toBe(70);
  expect(viewport.scrollTop).toBe(90);
  expect(screen.getByRole("slider", { name: "Horizontal line 2" }))
    .toHaveAttribute("aria-valuenow", "20");
  expect(screen.getByRole("slider", { name: "Vertical line 2" }))
    .toHaveAttribute("aria-valuenow", "15");
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
    name: "Download grid ground-truth JSON"
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
      },
      {
        itemId: "item-002",
        filename: "two.pdf",
        document: { width: 100, height: 120 },
        gridBounds: { top: 40, left: 30, width: 20, height: 20 },
        horizontalLinePositions: [40, 50, 60],
        verticalLinePositions: [30, 40, 50],
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
  expect(screen.getByRole("button", { name: "Download grid ground-truth JSON" }))
    .toBeInTheDocument();
  expect(screen.getByLabelText("item-001 annotation status"))
    .toHaveTextContent("annotated");
  expect(screen.getByLabelText("item-002 annotation status"))
    .toHaveTextContent("annotated");
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
