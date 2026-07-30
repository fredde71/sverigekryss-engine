export function createVerticalProjectionDiagnostics({
  projection,
  axisLength
}) {
  return {
    type: "vertical-projection-profile",
    axis: "vertical",
    ...createProjectionProfileSummary({
      projection,
      axisLength
    })
  };
}

export function createProjectionProfileSummary({
  projection,
  axisLength
}) {
  const values = Array.from(projection);
  const length = values.length;
  const maxStrength = length > 0 ? Math.max(...values) : 0;
  const meanStrength = length > 0
    ? values.reduce((sum, strength) => sum + strength, 0) / length
    : 0;
  const medianStrength = calculateMedian(values);
  const topPeaks = values
    .map((strength, position) => ({
      position,
      strength
    }))
    .sort((a, b) => b.strength - a.strength || a.position - b.position)
    .slice(0, 20);
  const runs = createProjectionRuns(values, axisLength);

  return {
    length,
    maxStrength,
    meanStrength,
    medianStrength,
    topPeaks,
    runCount: runs.length,
    topRuns: runs
      .slice()
      .sort((a, b) => b.maxStrength - a.maxStrength || a.start - b.start)
      .slice(0, 20)
  };
}

function calculateMedian(values) {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middle];
  }

  return (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

function createProjectionRuns(values, axisLength) {
  const runs = [];
  let start = null;
  let strengths = [];

  for (let i = 0; i <= values.length; i++) {
    const strength = values[i] || 0;
    const isProjectionRun = strength > 0;

    if (isProjectionRun && start === null) {
      start = i;
      strengths = [];
    }

    if (isProjectionRun) {
      strengths.push(strength);
    }

    if ((!isProjectionRun || i === values.length) && start !== null) {
      const end = i - 1;
      const maxStrength = Math.max(...strengths);
      const meanStrength = strengths.reduce((sum, value) => sum + value, 0) / strengths.length;

      runs.push({
        start,
        end,
        position: start + ((end - start) / 2),
        length: end - start + 1,
        maxStrength,
        meanStrength,
        maxCoverage: calculateCoverage(maxStrength, axisLength),
        meanCoverage: calculateCoverage(meanStrength, axisLength)
      });

      start = null;
      strengths = [];
    }
  }

  return runs;
}

function calculateCoverage(strength, axisLength) {
  return Number.isFinite(axisLength) && axisLength > 0
    ? strength / axisLength
    : 0;
}
