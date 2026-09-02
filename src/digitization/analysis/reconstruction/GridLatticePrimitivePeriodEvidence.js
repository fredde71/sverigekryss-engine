const AXES = Object.freeze(["horizontal", "vertical"]);

export function createGridLatticePrimitivePeriodEvidence({
  id,
  interpretationDiagnostics,
  coordinateScaleByAxis,
  evidenceReferences = [],
  interpretationEvidenceReferences = {},
  interpretationProvenance = {},
  provenance
} = {}) {
  validateInput({
    id,
    interpretationDiagnostics,
    coordinateScaleByAxis,
    evidenceReferences,
    interpretationEvidenceReferences,
    interpretationProvenance,
    provenance
  });

  const axes = Object.fromEntries(AXES.map(axis => [
    axis,
    createPeriodAxis({
      axis,
      diagnostic: interpretationDiagnostics?.[axis] ?? null,
      scale: coordinateScaleByAxis[axis],
      evidenceReferences:
        interpretationEvidenceReferences[axis] ?? [],
      interpretationProvenance:
        interpretationProvenance[axis] ?? []
    })
  ]));
  const status = axes.horizontal.status === "unavailable"
    || axes.vertical.status === "unavailable"
    ? "unavailable"
    : axes.horizontal.status === "ambiguous"
      || axes.vertical.status === "ambiguous"
      ? "ambiguous"
      : "available";

  return deepFreeze({
    id,
    status,
    axes,
    evidenceReferences: cloneValue(evidenceReferences),
    provenance: cloneValue(provenance)
  });
}

function createPeriodAxis({
  axis,
  diagnostic,
  scale,
  evidenceReferences,
  interpretationProvenance
}) {
  const interpretations = Array.isArray(diagnostic?.interpretations)
    ? diagnostic.interpretations
    : [];
  const candidates = [];
  const seen = new Set();

  interpretations.forEach((interpretation, interpretationIndex) => {
    const period = interpretation?.derivedSpacing * scale;
    if (!Number.isFinite(period) || period <= 0 || seen.has(String(period))) {
      return;
    }
    seen.add(String(period));
    candidates.push({
      id: `${axis}-period-${String(candidates.length + 1).padStart(3, "0")}`,
      period,
      evidenceReferences: cloneValue(
        evidenceReferences[interpretationIndex] ?? []
      ),
      provenance: {
        ...cloneValue(interpretationProvenance[interpretationIndex] ?? {}),
        axis,
        interpretationIndex,
        interpretationStatus: interpretation?.status ?? "rejected",
        rejectionReasons: cloneValue(
          interpretation?.rejectionReasons ?? []
        ),
        admission: cloneValue(interpretation?.admission ?? null),
        oneXSupport: cloneValue(interpretation?.oneXSupport ?? null),
        alignmentQualifiedOneXSupport: cloneValue(
          interpretation?.alignmentQualifiedOneXSupport ?? null
        ),
        candidateResiduals: cloneValue(
          interpretation?.candidateResiduals ?? []
        ),
        candidateAssignmentAttempts: cloneValue(
          interpretation?.candidateAssignmentAttempts ?? []
        ),
        alignmentResidualDiagnostics: cloneValue(
          interpretation?.alignmentResidualDiagnostics ?? null
        ),
        inferredLineCount: finiteOrNull(interpretation?.inferredLineCount),
        longestInferredRun: finiteOrNull(interpretation?.longestInferredRun),
        inferredLineFraction: finiteOrNull(
          interpretation?.inferredLineFraction
        ),
        skippedIntervalCounts: cloneValue(
          interpretation?.skippedIntervalCounts ?? []
        ),
        sourceInterpretation: cloneValue(interpretation)
      }
    });
  });

  return {
    axis,
    status: candidates.length === 0
      ? "unavailable"
      : candidates.length === 1
        ? "available"
        : "ambiguous",
    candidates,
    reasons: candidates.length === 0
      ? ["primitive-period-evidence-unavailable"]
      : []
  };
}

function validateInput({
  id,
  interpretationDiagnostics,
  coordinateScaleByAxis,
  evidenceReferences,
  interpretationEvidenceReferences,
  interpretationProvenance,
  provenance
}) {
  if (typeof id !== "string" || id.trim() === "") {
    throw new Error("Primitive period evidence id is required");
  }
  if (
    !interpretationDiagnostics
    || typeof interpretationDiagnostics !== "object"
    || Array.isArray(interpretationDiagnostics)
  ) {
    throw new Error("interpretationDiagnostics must be an axis object");
  }
  if (
    !coordinateScaleByAxis
    || typeof coordinateScaleByAxis !== "object"
    || Array.isArray(coordinateScaleByAxis)
  ) {
    throw new Error("coordinateScaleByAxis must be an axis object");
  }
  AXES.forEach(axis => {
    if (
      !Number.isFinite(coordinateScaleByAxis[axis])
      || coordinateScaleByAxis[axis] <= 0
    ) {
      throw new Error(`coordinateScaleByAxis.${axis} must be positive`);
    }
    const references = interpretationEvidenceReferences[axis] ?? [];
    if (!Array.isArray(references)) {
      throw new Error(
        `interpretationEvidenceReferences.${axis} must be an array`
      );
    }
    references.forEach((value, index) => {
      if (!Array.isArray(value)) {
        throw new Error(
          `interpretationEvidenceReferences.${axis}[${index}] must be an array`
        );
      }
      validateReferences(value);
    });
    const provenanceValues = interpretationProvenance[axis] ?? [];
    if (!Array.isArray(provenanceValues)) {
      throw new Error(`interpretationProvenance.${axis} must be an array`);
    }
  });
  validateReferences(evidenceReferences);
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    throw new Error("Primitive period evidence provenance is required");
  }
}

function validateReferences(references) {
  if (!Array.isArray(references)) {
    throw new Error("Evidence references must be an array");
  }
  references.forEach(reference => {
    if (typeof reference !== "string" || reference.trim() === "") {
      throw new Error("Evidence references must be non-empty strings");
    }
  });
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.keys(value).sort().reduce((clone, key) => {
    clone[key] = cloneValue(value[key]);
    return clone;
  }, {});
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
