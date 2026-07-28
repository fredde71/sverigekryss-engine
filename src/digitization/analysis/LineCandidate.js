export function findLineCandidates(projection, options = {}) {
  validateProjection(projection);

  const axisLength = options.axisLength;
  validateAxisLength(axisLength);

  const minCoverageRatio = options.minCoverageRatio ?? 0.8;
  validateMinCoverageRatio(minCoverageRatio);

  const minimumStrength = Math.max(1, Math.ceil(axisLength * minCoverageRatio));
  const candidates = [];
  let start = null;
  let strengthTotal = 0;
  let strengthMax = 0;

  for (let i = 0; i <= projection.length; i++) {
    const strength = projection[i] || 0;
    const isLinePixel = strength >= minimumStrength;

    if (isLinePixel && start === null) {
      start = i;
      strengthTotal = 0;
      strengthMax = 0;
    }

    if (isLinePixel) {
      strengthTotal += strength;
      strengthMax = Math.max(strengthMax, strength);
    }

    if ((!isLinePixel || i === projection.length) && start !== null) {
      const end = i - 1;
      const thickness = end - start + 1;

      candidates.push(createLineCandidate({
        axis: options.axis,
        start,
        end,
        position: start + ((thickness - 1) / 2),
        thickness,
        strength: strengthMax,
        averageStrength: strengthTotal / thickness
      }));

      start = null;
    }
  }

  return candidates;
}

export function createLineCandidate({
  axis,
  start,
  end,
  position,
  thickness,
  strength,
  averageStrength
}) {
  return {
    axis,
    start,
    end,
    position,
    thickness,
    strength,
    averageStrength
  };
}

function validateProjection(projection) {
  if (!projection || typeof projection.length !== "number") {
    throw new Error("Projection is required");
  }

  for (let i = 0; i < projection.length; i++) {
    if (!Number.isFinite(projection[i]) || projection[i] < 0) {
      throw new Error("Projection values must be finite non-negative numbers");
    }
  }
}

function validateAxisLength(axisLength) {
  if (!Number.isInteger(axisLength) || axisLength <= 0) {
    throw new Error("axisLength must be a positive integer");
  }
}

function validateMinCoverageRatio(minCoverageRatio) {
  if (!Number.isFinite(minCoverageRatio) || minCoverageRatio < 0 || minCoverageRatio > 1) {
    throw new Error("minCoverageRatio must be a number between 0 and 1");
  }
}
