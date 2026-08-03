import { createVerticalProjection } from "../analysis/Projection";
import { createProjectionProfileSummary } from "../detection/projectionDiagnostics";
import { createVerticalProjectionVisualization } from "./visualization/verticalProjectionVisualization";

const VERTICAL_LINE_MASK_MIN_SPAN_RATIO = 0.6;
const VERTICAL_LINE_MASK_MIN_SPAN_PIXELS = 3;

export const verticalLineMaskDiagnosticsExperiment = Object.freeze({
  id: "vertical-line-mask-diagnostics",
  description: "Compare the raw vertical projection with a connected-component vertical-line mask.",
  run(binaryImage, context = {}) {
    return createVerticalLineMaskProjectionComparison({
      binaryImage,
      rawVerticalProjection: resolveRawVerticalProjection(binaryImage, context)
    });
  }
});

export function createVerticalLineMaskProjectionComparison({
  binaryImage,
  rawVerticalProjection
}) {
  const verticalLineMask = createVerticalLineMask(binaryImage);
  const maskProjection = createVerticalProjection(verticalLineMask);

  return {
    type: "vertical-line-mask-projection-comparison",
    axis: "vertical",
    preprocessing: {
      maskType: "vertical-line",
      minVerticalSpan: verticalLineMask.minVerticalSpan,
      sourcePixelCount: verticalLineMask.sourcePixelCount,
      retainedPixelCount: verticalLineMask.retainedPixelCount,
      retainedPixelRatio: calculateRatio(
        verticalLineMask.retainedPixelCount,
        verticalLineMask.sourcePixelCount
      ),
      componentCount: verticalLineMask.componentCount,
      retainedComponentCount: verticalLineMask.retainedComponentCount
    },
    raw: createProjectionProfileSummary({
      projection: rawVerticalProjection,
      axisLength: binaryImage.height
    }),
    mask: createProjectionProfileSummary({
      projection: maskProjection,
      axisLength: binaryImage.height
    }),
    visualizations: [
      createVerticalProjectionVisualization({
        id: "vertical-projection",
        title: "Vertical Projection",
        axisLength: binaryImage.height,
        series: [
          {
            id: "raw",
            title: "Raw",
            values: rawVerticalProjection
          },
          {
            id: "mask",
            title: "Vertical-line mask",
            values: maskProjection
          }
        ]
      })
    ]
  };
}

function createVerticalLineMask(binaryImage) {
  const {
    width,
    height,
    data
  } = binaryImage;
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const minVerticalSpan = Math.min(
    height,
    Math.max(
      VERTICAL_LINE_MASK_MIN_SPAN_PIXELS,
      Math.ceil(height * VERTICAL_LINE_MASK_MIN_SPAN_RATIO)
    )
  );
  let sourcePixelCount = 0;
  let retainedPixelCount = 0;
  let componentCount = 0;
  let retainedComponentCount = 0;

  for (let index = 0; index < data.length; index++) {
    if (data[index] === 1) {
      sourcePixelCount += 1;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width) + x;

      if (data[index] !== 1 || visited[index] === 1) {
        continue;
      }

      componentCount += 1;

      const component = collectNearVerticalComponent({
        width,
        height,
        data,
        visited,
        startX: x,
        startY: y
      });
      const verticalSpan = component.maxY - component.minY + 1;

      if (verticalSpan >= minVerticalSpan) {
        retainedComponentCount += 1;

        for (const componentIndex of component.indices) {
          if (mask[componentIndex] === 0) {
            mask[componentIndex] = 1;
            retainedPixelCount += 1;
          }
        }
      }
    }
  }

  return {
    width,
    height,
    data: mask,
    minVerticalSpan,
    sourcePixelCount,
    retainedPixelCount,
    componentCount,
    retainedComponentCount
  };
}

function collectNearVerticalComponent({
  width,
  height,
  data,
  visited,
  startX,
  startY
}) {
  const queue = [
    {
      x: startX,
      y: startY
    }
  ];
  const indices = [];
  let minY = startY;
  let maxY = startY;

  visited[(startY * width) + startX] = 1;

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const {
      x,
      y
    } = queue[cursor];
    const index = (y * width) + x;

    indices.push(index);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) {
          continue;
        }

        const nextX = x + dx;
        const nextY = y + dy;

        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
          continue;
        }

        const nextIndex = (nextY * width) + nextX;

        if (data[nextIndex] !== 1 || visited[nextIndex] === 1) {
          continue;
        }

        visited[nextIndex] = 1;
        queue.push({
          x: nextX,
          y: nextY
        });
      }
    }
  }

  return {
    indices,
    minY,
    maxY
  };
}

function calculateRatio(value, total) {
  return Number.isFinite(value) && Number.isFinite(total) && total > 0
    ? value / total
    : 0;
}

function resolveRawVerticalProjection(binaryImage, context) {
  return context.rawVerticalProjection
    ?? context.projections?.vertical
    ?? createVerticalProjection(binaryImage);
}
