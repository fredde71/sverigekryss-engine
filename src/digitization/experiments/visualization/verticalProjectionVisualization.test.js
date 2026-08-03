import {
  createVerticalProjectionVisualization,
  VERTICAL_PROJECTION_VISUALIZATION_TYPE
} from "./verticalProjectionVisualization";

test("creates a reusable vertical projection visualization from typed profiles", () => {
  const raw = new Float64Array([0, 4, 1]);
  const mask = new Uint8Array([0, 3, 0]);

  const visualization = createVerticalProjectionVisualization({
    id: "vertical-projection",
    title: "Vertical Projection",
    axisLength: 8,
    series: [
      { id: "raw", title: "Raw", values: raw },
      { id: "mask", title: "Mask", values: mask }
    ]
  });

  expect(visualization).toEqual({
    id: "vertical-projection",
    title: "Vertical Projection",
    type: VERTICAL_PROJECTION_VISUALIZATION_TYPE,
    data: {
      axis: "vertical",
      axisLength: 8,
      length: 3,
      series: [
        { id: "raw", title: "Raw", values: [0, 4, 1] },
        { id: "mask", title: "Mask", values: [0, 3, 0] }
      ]
    }
  });
  expect(visualization.data.series[0].values).not.toBe(raw);
  expect(visualization.data.series[1].values).not.toBe(mask);
});

test("rejects projection series with different lengths", () => {
  expect(() => createVerticalProjectionVisualization({
    id: "vertical-projection",
    title: "Vertical Projection",
    axisLength: 8,
    series: [
      { id: "raw", title: "Raw", values: [0, 1] },
      { id: "mask", title: "Mask", values: [0] }
    ]
  })).toThrow("Vertical projection series must have equal lengths");
});
