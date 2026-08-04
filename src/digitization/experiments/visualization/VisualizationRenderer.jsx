import React from "react";
import ProjectionVisualization from "./ProjectionVisualization";

const VISUALIZATION_RENDERERS = Object.freeze({
  "vertical-projection": ProjectionVisualization
});

export default function VisualizationRenderer({ visualization }) {
  const Renderer = VISUALIZATION_RENDERERS[visualization?.type];

  if (!Renderer) {
    return (
      <div role="status">
        Unsupported visualization type: {visualization?.type || "missing"}
      </div>
    );
  }

  return <Renderer visualization={visualization} />;
}
