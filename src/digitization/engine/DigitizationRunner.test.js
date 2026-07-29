import { createDigitizationJob } from "../domain/DigitizationJob";
import {
  runDigitization,
  runDigitizationJobs
} from "./DigitizationRunner";

test("runDigitization runs a single provided job", async () => {
  const result = await runDigitization({
    job: createDigitizationJob({
      jobId: "job-1",
      source: {
        id: "source-1"
      }
    }),
    readImageData: jest.fn(async () => createGridImage())
  });

  expect(result).toMatchObject({
    jobId: "job-1",
    sourceId: "source-1",
    status: "completed"
  });
  expect(result.suggestions).toHaveLength(1);
});

test("runDigitization can create a job from a source", async () => {
  const result = await runDigitization({
    source: {
      id: "source-only"
    },
    readImageData: jest.fn(async () => createGridImage())
  });

  expect(result).toMatchObject({
    sourceId: "source-only",
    status: "completed"
  });
});

test("runDigitizationJobs runs multiple jobs in order", async () => {
  const jobs = [
    createDigitizationJob({
      jobId: "job-1",
      source: {
        id: "source-1"
      }
    }),
    createDigitizationJob({
      jobId: "job-2",
      source: {
        id: "source-2"
      }
    })
  ];
  const readImageData = jest.fn(async source => (
    source.id === "source-1"
      ? createGridImage()
      : createBlankImage()
  ));

  const results = await runDigitizationJobs({
    jobs,
    readImageData
  });

  expect(results.map(result => result.jobId)).toEqual(["job-1", "job-2"]);
  expect(results[0].suggestions).toHaveLength(1);
  expect(results[1].suggestions).toEqual([]);
  expect(results[1].diagnostics).toEqual(expect.arrayContaining([
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
      type: "acceptance-status",
      accepted: false
    })
  ]));
});

test("runDigitizationJobs returns an empty array for no jobs", async () => {
  await expect(
    runDigitizationJobs({
      jobs: [],
      readImageData: jest.fn()
    })
  ).resolves.toEqual([]);
});

test("runDigitizationJobs propagates readImageData errors", async () => {
  await expect(
    runDigitizationJobs({
      jobs: [
        createDigitizationJob({
          jobId: "job-error",
          source: {
            id: "source-error"
          }
        })
      ],
      readImageData: jest.fn(async () => {
        throw new Error("reader failed");
      })
    })
  ).rejects.toThrow("reader failed");
});

test("runDigitizationJobs is deterministic", async () => {
  const jobs = [
    createDigitizationJob({
      jobId: "job-1",
      source: {
        id: "source-1"
      }
    }),
    createDigitizationJob({
      jobId: "job-2",
      source: {
        id: "source-2"
      }
    })
  ];
  const readImageData = jest.fn(async () => createGridImage());
  const first = await runDigitizationJobs({
    jobs,
    readImageData
  });
  const second = await runDigitizationJobs({
    jobs,
    readImageData
  });

  expect(first).toEqual(second);
});

test("runDigitizationJobs does not mutate input jobs", async () => {
  const job = createDigitizationJob({
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

  await runDigitizationJobs({
    jobs: [job],
    readImageData: jest.fn(async () => createGridImage())
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
});

function createGridImage() {
  return createRgbaImage({
    width: 5,
    height: 5,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  });
}

function createBlankImage() {
  return createRgbaImage({
    width: 5,
    height: 5
  });
}

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
