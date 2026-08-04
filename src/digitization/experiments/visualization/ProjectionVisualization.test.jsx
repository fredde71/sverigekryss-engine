import { render, screen, within } from "@testing-library/react";
import ProjectionVisualization from "./ProjectionVisualization";

test("renders multiple series with distinct neutral shades and shared scaling", () => {
  render(
    <ProjectionVisualization
      visualization={createVisualization([
        { id: "raw", title: "Raw", values: [0, 10] },
        { id: "scores", title: "Continuity", values: [5, 2.5] },
        { id: "mask", title: "Mask", values: [8, 0] }
      ])}
    />
  );

  expect(screen.getByRole("region", { name: "Raw" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Continuity" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Mask" })).toBeInTheDocument();

  const bars = screen.getAllByRole("listitem");
  expect(bars.map(readBarWidth)).toEqual([
    "0%",
    "100%",
    "50%",
    "25%",
    "80%",
    "0%"
  ]);
  expect(readBarShade(bars[0])).not.toBe(readBarShade(bars[2]));
  expect(readBarShade(bars[2])).not.toBe(readBarShade(bars[4]));
});

test("renders an explicit empty state for a series without values", () => {
  render(
    <ProjectionVisualization
      visualization={createVisualization([
        { id: "raw", title: "Raw", values: [] }
      ])}
    />
  );

  expect(screen.getByRole("region", { name: "Raw" })).toHaveTextContent(
    "No projection values."
  );
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
});

test("renders at most 250 bars for 2500 source values", () => {
  render(
    <ProjectionVisualization
      visualization={createVisualization([
        {
          id: "raw",
          title: "Raw",
          values: Array.from({ length: 2500 }, (_, index) => index)
        }
      ])}
    />
  );

  expect(screen.getAllByRole("listitem")).toHaveLength(250);
});

test("maximum bucketing preserves a thin projection peak", () => {
  const values = Array(2500).fill(0);
  values[1234] = 100;

  render(
    <ProjectionVisualization
      visualization={createVisualization([
        { id: "raw", title: "Raw", values }
      ])}
    />
  );

  const peakBucket = screen.getByRole("listitem", {
    name: "Raw positions 1230–1239: 100"
  });
  expect(readBarWidth(peakBucket)).toBe("100%");
});

test("uses identical bucket boundaries across multiple series", () => {
  const sourceValues = Array.from({ length: 503 }, (_, index) => index);

  render(
    <ProjectionVisualization
      visualization={createVisualization([
        { id: "raw", title: "Raw", values: sourceValues },
        { id: "mask", title: "Mask", values: sourceValues.map(() => 1) }
      ])}
    />
  );

  const rawRanges = readAccessibleRanges(
    screen.getByRole("region", { name: "Raw" })
  );
  const maskRanges = readAccessibleRanges(
    screen.getByRole("region", { name: "Mask" })
  );

  expect(rawRanges).toEqual(maskRanges);
  expect(rawRanges).toHaveLength(250);
});

test("accessible labels expose every represented source range", () => {
  render(
    <ProjectionVisualization
      visualization={createVisualization([
        {
          id: "raw",
          title: "Raw",
          values: Array.from({ length: 500 }, (_, index) => index)
        }
      ])}
    />
  );

  expect(screen.getByRole("listitem", {
    name: "Raw positions 120–121: 121"
  })).toBeInTheDocument();
});

test("keeps negative and non-finite values as zero-width bars", () => {
  render(
    <ProjectionVisualization
      visualization={createVisualization([
        { id: "raw", title: "Raw", values: [-2, NaN, Infinity, 5] }
      ])}
    />
  );

  expect(screen.getAllByRole("listitem").map(readBarWidth)).toEqual([
    "0%",
    "0%",
    "0%",
    "100%"
  ]);
});

test("renders the same ordered ranges, widths and shades for the same visualization", () => {
  const visualization = createVisualization([
    { id: "raw", title: "Raw", values: [1, 3, 2] },
    { id: "mask", title: "Mask", values: [0, 3, 0] }
  ]);
  const first = render(
    <ProjectionVisualization visualization={visualization} />
  );
  const firstBehavior = readRenderedBehavior();

  first.unmount();

  render(
    <ProjectionVisualization visualization={visualization} />
  );

  expect(readRenderedBehavior()).toEqual(firstBehavior);
});

function readBarWidth(listItem) {
  return listItem.firstElementChild.style.width;
}

function readBarShade(listItem) {
  return listItem.firstElementChild.style.background;
}

function readAccessibleRanges(region) {
  return within(region).getAllByRole("listitem").map((listItem) => {
    const match = listItem.getAttribute("aria-label").match(/positions (\d+–\d+)/);
    return match?.[1];
  });
}

function readRenderedBehavior() {
  return screen.getAllByRole("listitem").map((listItem) => ({
    label: listItem.getAttribute("aria-label"),
    width: readBarWidth(listItem),
    shade: readBarShade(listItem)
  }));
}

function createVisualization(series) {
  return {
    id: "vertical-projection",
    title: "Vertical Projection",
    type: "vertical-projection",
    data: {
      axis: "vertical",
      axisLength: 10,
      length: series[0]?.values.length || 0,
      series
    }
  };
}
