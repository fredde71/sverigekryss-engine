import { render, screen } from "@testing-library/react";
import VisualizationRenderer from "./VisualizationRenderer";

test("dispatches vertical-projection visualizations to the projection renderer", () => {
  render(
    <VisualizationRenderer
      visualization={{
        id: "projection",
        title: "Publisher columns",
        type: "vertical-projection",
        data: {
          axis: "vertical",
          axisLength: 10,
          length: 2,
          series: [
            { id: "raw", title: "Raw", values: [2, 10] }
          ]
        }
      }}
    />
  );

  expect(screen.getByRole("region", { name: "Publisher columns" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Raw" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});

test("reports an unknown visualization type without throwing", () => {
  render(
    <VisualizationRenderer
      visualization={{
        id: "future",
        title: "Future visualization",
        type: "binary-mask",
        data: {}
      }}
    />
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    "Unsupported visualization type: binary-mask"
  );
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
});
