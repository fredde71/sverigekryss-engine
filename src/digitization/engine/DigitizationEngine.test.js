import { createDigitizationJob } from "../domain/DigitizationJob";
import { runDigitizationJob } from "./DigitizationEngine";

test("runDigitizationJob orchestrates a single job through image grid detection", async () => {
  const result = await runDigitizationJob({
    job: createDigitizationJob({
      jobId: "job-1",
      source: {
        id: "source-1"
      }
    }),
    readImageData: jest.fn(async () => createRgbaImage({
      width: 5,
      height: 5,
      darkRows: [0, 2, 4],
      darkCols: [0, 2, 4]
    }))
  });

  expect(result).toMatchObject({
    jobId: "job-1",
    sourceId: "source-1",
    status: "completed",
    gridDetection: {
      confidence: "detected",
      geometry: {
        rows: 2,
        cols: 2
      },
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          type: "candidate-counts",
          axis: "horizontal",
          acceptedCount: 3,
          rejectedCount: 2,
          totalCount: 5
        }),
        expect.objectContaining({
          type: "candidate-counts",
          axis: "vertical",
          acceptedCount: 3,
          rejectedCount: 2,
          totalCount: 5
        }),
        expect.objectContaining({
          type: "acceptance-status",
          accepted: true
        })
      ])
    },
    diagnostics: expect.arrayContaining([
      expect.objectContaining({
        type: "candidate-counts",
        axis: "horizontal",
        acceptedCount: 3,
        rejectedCount: 2,
        totalCount: 5
      }),
      expect.objectContaining({
        type: "candidate-counts",
        axis: "vertical",
        acceptedCount: 3,
        rejectedCount: 2,
        totalCount: 5
      }),
      expect.objectContaining({
        type: "acceptance-status",
        accepted: true
      })
    ])
  });
  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0]).toMatchObject({
    sourceId: "source-1",
    confidence: "detected"
  });
});

test("runDigitizationJob preserves diagnostics and empty suggestions when grid is missing", async () => {
  const result = await runDigitizationJob({
    job: createDigitizationJob({
      jobId: "job-empty",
      source: {
        id: "empty-source"
      }
    }),
    readImageData: jest.fn(async () => createRgbaImage({
      width: 5,
      height: 5
    }))
  });

  expect(result.suggestions).toEqual([]);
  expect(result.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: "candidate-counts",
      axis: "horizontal",
      acceptedCount: 0,
      rejectedCount: 0,
      totalCount: 0
    }),
    expect.objectContaining({
      type: "candidate-counts",
      axis: "vertical",
      acceptedCount: 0,
      rejectedCount: 0,
      totalCount: 0
    }),
    expect.objectContaining({
      type: "rejection-reason",
      axis: "horizontal",
      candidateCount: 0,
      minimumCount: 2
    }),
    expect.objectContaining({
      type: "rejection-reason",
      axis: "vertical",
      candidateCount: 0,
      minimumCount: 2
    }),
    expect.objectContaining({
      type: "acceptance-status",
      accepted: false
    })
  ]));
  expect(result.gridDetection).toEqual({
    geometry: null,
    confidence: "missing-grid-geometry",
    diagnostics: result.diagnostics
  });
});

test("runDigitizationJob propagates readImageData errors", async () => {
  const error = new Error("read failed");

  await expect(
    runDigitizationJob({
      job: createDigitizationJob({
        jobId: "job-error",
        source: {
          id: "source-error"
        }
      }),
      readImageData: jest.fn(async () => {
        throw error;
      })
    })
  ).rejects.toThrow("read failed");
});

test("runDigitizationJob is deterministic for equivalent image input", async () => {
  const job = createDigitizationJob({
    jobId: "job-deterministic",
    source: {
      id: "source-deterministic"
    }
  });
  const readImageData = jest.fn(async () => createRgbaImage({
    width: 5,
    height: 5,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  }));

  const first = await runDigitizationJob({
    job,
    readImageData
  });
  const second = await runDigitizationJob({
    job,
    readImageData
  });

  expect(first.gridDetection).toEqual(second.gridDetection);
  expect(first.suggestions).toEqual(second.suggestions);
  expect(first.diagnostics).toEqual(second.diagnostics);
});

test("runDigitizationJob does not mutate job, source, options or image data", async () => {
  const source = {
    id: "source-immutable",
    metadata: {
      name: "source"
    }
  };
  const options = {
    threshold: 128
  };
  const imageData = createRgbaImage({
    width: 5,
    height: 5,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  });
  const originalPixels = Array.from(imageData.data);
  const job = createDigitizationJob({
    jobId: "job-immutable",
    source,
    options
  });

  await runDigitizationJob({
    job,
    readImageData: jest.fn(async () => imageData)
  });

  expect(job).toEqual({
    jobId: "job-immutable",
    source: {
      id: "source-immutable",
      metadata: {
        name: "source"
      }
    },
    options: {
      threshold: 128
    }
  });
  expect(source.metadata.name).toBe("source");
  expect(options.threshold).toBe(128);
  expect(Array.from(imageData.data)).toEqual(originalPixels);
});

test("runDigitizationJob requires a source", async () => {
  await expect(
    runDigitizationJob({
      job: createDigitizationJob({
        jobId: "missing-source"
      }),
      readImageData: jest.fn()
    })
  ).rejects.toThrow("DigitizationJob source is required");
});

function createRgbaImage({
  width,
  height,
  darkRows = [],
  darkCols = []
}) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const isDark = darkRows.includes(y) || darkCols.includes(x);
      const value = isDark ? 0 : 255;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return {
    width,
    height,
    data
  };
}
