import { createDigitizationJob } from "./DigitizationJob";

test("createDigitizationJob returns a minimal immutable job", () => {
  const job = createDigitizationJob({
    jobId: "job-1",
    source: {
      id: "source-1"
    },
    options: {
      threshold: 100
    }
  });

  expect(job).toEqual({
    jobId: "job-1",
    source: {
      id: "source-1"
    },
    options: {
      threshold: 100
    }
  });
  expect(Object.isFrozen(job)).toBe(true);
  expect(Object.isFrozen(job.source)).toBe(true);
  expect(Object.isFrozen(job.options)).toBe(true);
});

test("createDigitizationJob clones input values defensively", () => {
  const source = {
    id: "source-1",
    metadata: {
      name: "one"
    }
  };
  const options = {
    threshold: 100
  };
  const job = createDigitizationJob({
    jobId: "job-1",
    source,
    options
  });

  source.metadata.name = "changed";
  options.threshold = 200;

  expect(job.source.metadata.name).toBe("one");
  expect(job.options.threshold).toBe(100);
});
