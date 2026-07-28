import { createDigitizationJob } from "../domain/DigitizationJob";
import { runDigitizationJob } from "./DigitizationEngine";

export async function runDigitization({
  job,
  source,
  options = {},
  readImageData
}) {
  const digitizationJob = job || createDigitizationJob({
    source,
    options
  });

  return runDigitizationJob({
    job: digitizationJob,
    readImageData,
    options
  });
}

export async function runDigitizationJobs({
  jobs = [],
  options = {},
  readImageData
}) {
  const results = [];

  for (const job of jobs) {
    results.push(await runDigitizationJob({
      job,
      readImageData,
      options
    }));
  }

  return results;
}
