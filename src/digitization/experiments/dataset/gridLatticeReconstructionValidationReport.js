import { createGridLatticeEvidence } from "../../analysis/reconstruction/GridLatticeEvidence";
import {
  generateGridLatticeCandidates
} from "../../analysis/reconstruction/GridLatticeCandidateGeneration";
import {
  fuseGridLatticeCandidateEvidence
} from "../../analysis/reconstruction/GridLatticeEvidenceFusion";
import {
  selectGridLatticeCandidate
} from "../../analysis/reconstruction/GridLatticeCandidateSelection";
import {
  createGridLatticeBoundsEvidenceProjection
} from "../../analysis/reconstruction/GridLatticeBoundsEvidenceProjection";
import { compareLinePositions } from "./shadowGridValidationReport";

const REPORT_VERSION = 1;
const GRID_ANALYSIS_EXPERIMENT_ID = "shadow-grid-analysis-diagnostics";
const RECONSTRUCTION_EXPERIMENT_ID = "shadow-grid-reconstruction-diagnostics";
const OUTER_GEOMETRY_EXPERIMENT_ID =
  "shadow-outer-line-center-geometry-diagnostics";
const STRATEGY_DIAGNOSTIC_TYPE = "uniform-orthogonal-lattice-strategy";

export function createGridLatticeReconstructionValidationReport(input = {}) {
  return createGridLatticeReconstructionValidationReportFactory()(input);
}

export function createGridLatticeReconstructionValidationReportFactory({
  createEvidence = createGridLatticeEvidence,
  generateCandidates = generateGridLatticeCandidates,
  fuseEvidence = fuseGridLatticeCandidateEvidence,
  selectCandidate = selectGridLatticeCandidate,
  createReconstruction = createFactoredValidationReconstructionResult,
  projectBounds = createGridLatticeBoundsEvidenceProjection
} = {}) {
  [
    [createEvidence, "createEvidence"],
    [generateCandidates, "generateCandidates"],
    [fuseEvidence, "fuseEvidence"],
    [selectCandidate, "selectCandidate"],
    [createReconstruction, "createReconstruction"],
    [projectBounds, "projectBounds"]
  ].forEach(([dependency, name]) => {
    if (typeof dependency !== "function") {
      throw new Error(`${name} must be a function`);
    }
  });

  return function createReport({ datasetReport, groundTruth } = {}) {
    validateDatasetReport(datasetReport);

    // Reconstruction is intentionally complete before Ground Truth is read.
    const reconstructionItems = datasetReport.items.map(item => (
      reconstructDatasetItem(item, {
        createEvidence,
        generateCandidates,
        fuseEvidence,
        selectCandidate,
        createReconstruction,
        projectBounds
      })
    ));

    validateGroundTruth(groundTruth, datasetReport.datasetRun.datasetId);
    const annotationsByItemId = new Map(
      groundTruth.annotations.map(annotation => [annotation.itemId, annotation])
    );
    const datasetItemIds = new Set(datasetReport.items.map(item => item.id));
    const items = reconstructionItems.map(item => compareItem(
      item,
      annotationsByItemId.get(item.itemId) ?? null
    ));
    const comparisons = items.flatMap(item => item.reconstructions);
    const unmatchedAnnotations = groundTruth.annotations
      .filter(annotation => !datasetItemIds.has(annotation.itemId))
      .map(annotation => ({
        itemId: annotation.itemId,
        filename: annotation.filename,
        reason: "dataset-item-not-found"
      }));

    return deepFreeze({
      type: "grid-lattice-reconstruction-validation-report",
      version: REPORT_VERSION,
      datasetId: datasetReport.datasetRun.datasetId,
      status: "complete",
      validationPolicy: {
        reconstructionChain: [
          "grid-lattice-candidate-generation",
          "grid-lattice-evidence-fusion",
          "grid-lattice-candidate-selection",
          "grid-lattice-reconstruction-result"
        ],
        groundTruthUsage: "post-reconstruction-validation-only",
        lineEquality: "exact-numeric-equality",
        lineDelta: "reconstructed-minus-ground-truth",
        nearestLineTie: "lowest-index",
        correction: "none",
        snapping: "none"
      },
      inventory: {
        totalDatasetItemCount: items.length,
        annotatedItemCount: items.filter(item => (
          item.groundTruth.status === "available"
        )).length,
        reconstructionObservationCount: comparisons.length,
        availableReconstructionCount: comparisons.filter(value => (
          value.reconstruction.status === "available"
        )).length,
        comparedReconstructionCount: comparisons.filter(value => (
          value.validation.status === "compared"
        )).length,
        exactDimensionMatchCount: comparisons.filter(value => (
          value.validation.exactDimensionMatch === true
        )).length,
        unmatchedAnnotationCount: unmatchedAnnotations.length
      },
      items,
      unmatchedAnnotations
    });
  };
}

function reconstructDatasetItem(item, dependencies) {
  const filename = typeof item?.metadata?.filename === "string"
    ? item.metadata.filename
    : null;
  const gridDiagnostics = readExperiment(item, GRID_ANALYSIS_EXPERIMENT_ID);
  const reconstructionDiagnostics = readExperiment(
    item,
    RECONSTRUCTION_EXPERIMENT_ID
  );
  const geometryDiagnostics = readExperiment(
    item,
    OUTER_GEOMETRY_EXPERIMENT_ID
  );
  const boundsEvidence = geometryDiagnostics
    ? dependencies.projectBounds({
      outerLineGeometryDiagnostics: geometryDiagnostics
    })
    : null;
  const regions = [];

  if (gridDiagnostics && reconstructionDiagnostics && boundsEvidence) {
    for (const provider of gridDiagnostics.providers ?? []) {
      if (provider?.status !== "available") {
        continue;
      }
      const reconstructionProvider = findById(
        reconstructionDiagnostics.providers,
        provider.id
      );
      const boundsProvider = findById(boundsEvidence.providers, provider.id);

      for (const gridRegion of provider.gridAnalyses ?? []) {
        const reconstructionRegion = findRegion(
          reconstructionProvider?.reconstructions,
          gridRegion?.regionId
        );
        const boundsRegion = findRegion(
          boundsProvider?.regions,
          gridRegion?.regionId
        );
        const availableBounds = createUniqueBoundsCompatibilityInput(boundsRegion);

        if (availableBounds.length === 0) {
          if (boundsRegion?.status === "ambiguous") {
            regions.push(runReconstructionChain({
              providerId: provider.id,
              regionId: gridRegion?.regionId,
              observationIndex: null,
              gridRegion,
              reconstructionRegion,
              boundsEvidenceRegion: boundsRegion,
              boundsObservation: createFactoredBoundsPlaceholder(boundsRegion),
              factoredBounds: boundsRegion,
              dependencies
            }));
            continue;
          }
          regions.push(createUnavailableReconstruction({
            providerId: provider.id,
            regionId: gridRegion?.regionId,
            status: "unavailable",
            reason: "outer-line-center-envelope-observation-unavailable",
            sourceBoundsSpace: createSourceBoundsSpace(boundsRegion)
          }));
          continue;
        }

        availableBounds.forEach((boundsCandidate, observationIndex) => {
          regions.push(runReconstructionChain({
            providerId: provider.id,
            regionId: gridRegion?.regionId,
            observationIndex,
            gridRegion,
            reconstructionRegion,
            boundsEvidenceRegion: boundsRegion,
            boundsObservation: boundsCandidate.boundsObservation,
            dependencies
          }));
        });
      }
    }
  }

  return {
    itemId: item?.id,
    filename,
    sourceStatus: {
      gridAnalysis: gridDiagnostics ? "available" : "unavailable",
      reconstructionDiagnostics:
        reconstructionDiagnostics ? "available" : "unavailable",
      outerBoundsDiagnostics: geometryDiagnostics ? "available" : "unavailable"
    },
    reconstructions: regions
  };
}

function createUniqueBoundsCompatibilityInput(boundsRegion) {
  if (
    boundsRegion?.rectangularCombinationSpace?.exactCombinationCount !== 1
    || boundsRegion?.axisBounds?.horizontal?.length !== 1
    || boundsRegion?.axisBounds?.vertical?.length !== 1
  ) {
    return [];
  }

  const horizontal = boundsRegion.axisBounds.horizontal[0];
  const vertical = boundsRegion.axisBounds.vertical[0];
  const edgeInterpretations = {
    top: cloneValue(horizontal.startAlternative),
    bottom: cloneValue(horizontal.endAlternative),
    left: cloneValue(vertical.startAlternative),
    right: cloneValue(vertical.endAlternative)
  };
  const interpretationIds = Object.values(edgeInterpretations).map(
    value => value.interpretationId
  );
  const interpretationId = interpretationIds.every(
    value => value === interpretationIds[0]
  )
    ? interpretationIds[0]
    : "mixed-edge-geometric-descriptions";
  const evidenceReferences = [
    ...horizontal.evidenceReferences,
    ...vertical.evidenceReferences
  ];
  const provenance = {
    source: "shadow-outer-line-center-geometry-diagnostics",
    providerId: boundsRegion.providerId,
    regionId: boundsRegion.regionId,
    interpretationId,
    establishment: "unconfirmed-observational-outer-line-envelope",
    sourceObservationProvenance: cloneValue(
      horizontal.provenance.sourceObservationProvenance
    ),
    sourceEdgeProvenance: {
      top: cloneValue(horizontal.provenance.sourceEdgeProvenance.top),
      bottom: cloneValue(horizontal.provenance.sourceEdgeProvenance.bottom),
      left: cloneValue(vertical.provenance.sourceEdgeProvenance.left),
      right: cloneValue(vertical.provenance.sourceEdgeProvenance.right)
    }
  };

  return [{
    boundsObservation: {
      status: "available",
      semantics: "outer-line-center-envelope",
      coordinateSpace: horizontal.coordinateSystem.space,
      bounds: {
        top: horizontal.start,
        left: vertical.start,
        width: vertical.span,
        height: horizontal.span
      },
      provenance,
      evidenceReferences
    }
  }];
}

function createFactoredBoundsPlaceholder(boundsRegion) {
  return {
    status: "unavailable",
    semantics: "outer-line-center-envelope",
    coordinateSpace: boundsRegion.coordinateSystem.space,
    bounds: null,
    provenance: {
      source: "grid-lattice-reconstruction-bounds-evidence",
      providerId: boundsRegion.providerId,
      regionId: boundsRegion.regionId,
      representation: "factored-axis-bounds",
      singularEnvelope: "not-materialized"
    },
    evidenceReferences: []
  };
}

function createSourceBoundsSpace(boundsRegion) {
  if (!boundsRegion) {
    return null;
  }
  return cloneValue({
    status: boundsRegion.status,
    coordinateSystem: boundsRegion.coordinateSystem,
    sourceCoordinateSystem: boundsRegion.sourceCoordinateSystem,
    sourceAcceptedCandidateEnvelope:
      boundsRegion.sourceAcceptedCandidateEnvelope ?? null,
    interpretationOrder: boundsRegion.interpretationOrder,
    interpretationInventory: boundsRegion.interpretationInventory,
    edgeAlternativeInventory: boundsRegion.edgeAlternativeInventory,
    combinationInventory: boundsRegion.combinationInventory,
    axisBounds: boundsRegion.axisBounds,
    rectangularCombinationSpace: boundsRegion.rectangularCombinationSpace,
    provenance: boundsRegion.provenance,
    reasons: boundsRegion.reasons
  });
}

export function createFactoredValidationReconstructionResult({
  candidateGeneration,
  evidenceFusion,
  candidateSelection
} = {}) {
  validateFactoredReconstructionInputs({
    candidateGeneration,
    evidenceFusion,
    candidateSelection
  });
  const selectedReference = candidateSelection.selectedCandidateReference;
  const horizontal = selectedReference
    ? findAxisCandidate(
      candidateGeneration.axisCandidates.horizontal,
      selectedReference.horizontalAxisCandidateId
    )
    : null;
  const vertical = selectedReference
    ? findAxisCandidate(
      candidateGeneration.axisCandidates.vertical,
      selectedReference.verticalAxisCandidateId
    )
    : null;
  const status = candidateSelection.status === "selected"
    ? "available"
    : candidateSelection.status;
  const lattice = selectedReference
    ? {
      gridDimensions: {
        rows: horizontal.intervalCount,
        cols: vertical.intervalCount
      },
      axes: {
        horizontal: materializeSelectedAxis(horizontal),
        vertical: materializeSelectedAxis(vertical)
      },
      coordinateSystem: cloneValue(candidateGeneration.coordinateSystem)
    }
    : null;

  return {
    status,
    lattice,
    sourceCandidateId: selectedReference?.candidateId ?? null,
    sourceCandidateReference: cloneValue(selectedReference),
    reconstructionProvenance: {
      materializer: "grid-lattice-reconstruction-result-v1",
      candidateGeneration: {
        type: candidateGeneration.type,
        version: candidateGeneration.version,
        status: candidateGeneration.status,
        evidenceId: candidateGeneration.evidenceId,
        primitivePeriodEvidenceId:
          candidateGeneration.primitivePeriodEvidenceId,
        provenance: cloneValue(candidateGeneration.provenance),
        candidateSpace: cloneValue(candidateGeneration.candidateSpace)
      },
      evidenceFusion: {
        type: evidenceFusion.type,
        version: evidenceFusion.version,
        status: evidenceFusion.status,
        provenance: cloneValue(evidenceFusion.provenance),
        confidenceSpace: cloneValue(evidenceFusion.confidenceSpace)
      },
      candidateDecision: {
        status: candidateSelection.status,
        selectedCandidateId: candidateSelection.selectedCandidateId,
        selectedCandidateReference: cloneValue(selectedReference),
        decisionPolicy: cloneValue(candidateSelection.decisionPolicy),
        decisionProvenance: compactDecisionProvenance(
          candidateSelection.decisionProvenance
        )
      }
    },
    reasons: candidateSelection.reasons.slice()
  };
}

function validateFactoredReconstructionInputs({
  candidateGeneration,
  evidenceFusion,
  candidateSelection
}) {
  if (
    candidateGeneration?.type !== "grid-lattice-candidate-generation"
    || candidateGeneration?.candidateSpace?.representation
      !== "cartesian-product-by-reference"
    || evidenceFusion?.type !== "grid-lattice-evidence-fusion"
    || evidenceFusion?.confidenceSpace?.representation
      !== "cartesian-product-by-reference"
    || candidateSelection?.type !== "grid-lattice-candidate-selection"
  ) {
    throw new Error("factored reconstruction inputs are required");
  }
  if (
    candidateGeneration.evidenceId !== evidenceFusion.evidenceId
    || candidateGeneration.primitivePeriodEvidenceId
      !== evidenceFusion.primitivePeriodEvidenceId
    || candidateGeneration.candidateSpace.exactCandidateCount
      !== evidenceFusion.confidenceSpace.exactConfidenceCount
  ) {
    throw new Error("factored reconstruction sources must match");
  }
  if (candidateSelection.status === "selected") {
    const reference = candidateSelection.selectedCandidateReference;
    const verticalCandidateCount =
      candidateGeneration.axisCandidates.vertical.length;
    const horizontalIndex = Math.floor(
      reference?.candidateIndex / verticalCandidateCount
    );
    const verticalIndex = reference?.candidateIndex % verticalCandidateCount;
    const horizontal = findAxisCandidate(
      candidateGeneration.axisCandidates.horizontal,
      reference?.horizontalAxisCandidateId
    );
    const vertical = findAxisCandidate(
      candidateGeneration.axisCandidates.vertical,
      reference?.verticalAxisCandidateId
    );
    if (
      !reference
      || reference.candidateId !== candidateSelection.selectedCandidateId
      || !horizontal
      || !vertical
      || evidenceFusion.axisEvidence.horizontal[horizontalIndex]
        ?.axisCandidateId !== horizontal.id
      || evidenceFusion.axisEvidence.vertical[verticalIndex]
        ?.axisCandidateId !== vertical.id
    ) {
      throw new Error("selected factored candidate reference is invalid");
    }
  } else if (candidateSelection.selectedCandidateReference !== null) {
    throw new Error("non-selected factored result cannot reference a candidate");
  }
}

function findAxisCandidate(candidates, id) {
  return Array.isArray(candidates)
    ? candidates.find(candidate => candidate.id === id) ?? null
    : null;
}

function materializeSelectedAxis(axisCandidate) {
  return {
    origin: axisCandidate.origin,
    period: axisCandidate.period,
    intervalCount: axisCandidate.intervalCount,
    lineCount: axisCandidate.lineCount,
    positions: Array.from(
      { length: axisCandidate.lineCount },
      (_value, index) => axisCandidate.origin + index * axisCandidate.period
    )
  };
}

function compactDecisionProvenance(provenance) {
  if (!provenance) {
    return null;
  }
  return cloneValue({
    candidateGeneration: provenance.candidateGeneration,
    evidenceFusion: provenance.evidenceFusion,
    confidenceSpace: provenance.confidenceSpace,
    referenceLookup: provenance.referenceLookup
  });
}

function runReconstructionChain({
  providerId,
  regionId,
  observationIndex,
  gridRegion,
  reconstructionRegion,
  boundsEvidenceRegion,
  boundsObservation,
  factoredBounds = null,
  dependencies
}) {
  try {
    const transform = readGridRegionTransform(
      gridRegion,
      reconstructionRegion,
      boundsEvidenceRegion
    );
    const positions = normalizeCandidatePositions(gridRegion, transform);
    const primitivePeriodEvidence = createPrimitivePeriodEvidence({
      providerId,
      regionId,
      reconstructionRegion,
      transform
    });
    const evidence = dependencies.createEvidence({
      id: `grid-lattice-evidence:${providerId}:${regionId}:${observationIndex}`,
      status: "available",
      coordinateSystem: renderedCoordinateSystem(),
      axes: {
        horizontal: createAxisEvidence("horizontal", positions.horizontal),
        vertical: createAxisEvidence("vertical", positions.vertical)
      },
      boundsObservation,
      provenance: {
        source: "digitization-dataset-report",
        providerId,
        regionId,
        boundsObservationIndex: observationIndex
      },
      evidenceReferences: [
        `${GRID_ANALYSIS_EXPERIMENT_ID}:${providerId}:${regionId}`,
        `${OUTER_GEOMETRY_EXPERIMENT_ID}:${providerId}:${regionId}:${observationIndex}`
      ],
      diagnostics: [],
      reasons: []
    });
    const generationInput = {
      evidence,
      primitivePeriodEvidence
    };
    if (factoredBounds) {
      generationInput.factoredBounds = factoredBounds;
    }
    const generation = dependencies.generateCandidates(generationInput);
    const fusion = dependencies.fuseEvidence({
      candidateGeneration: generation,
      evidence,
      primitivePeriodEvidence
    });
    const selection = dependencies.selectCandidate({
      candidateGeneration: generation,
      evidenceFusion: fusion
    });
    const result = dependencies.createReconstruction({
      candidateGeneration: generation,
      evidenceFusion: fusion,
      candidateSelection: selection
    });

    return compactReconstruction({
      providerId,
      regionId,
      observationIndex,
      boundsObservation,
      boundsEvidenceRegion,
      primitivePeriodEvidence,
      generation,
      fusion,
      selection,
      result
    });
  } catch (error) {
    return createUnavailableReconstruction({
      providerId,
      regionId,
      observationIndex,
      status: "unavailable",
      reason: normalizeError(error),
      sourceBoundsSpace: createSourceBoundsSpace(boundsEvidenceRegion)
    });
  }
}

function compactReconstruction({
  providerId,
  regionId,
  observationIndex,
  boundsObservation,
  boundsEvidenceRegion,
  primitivePeriodEvidence,
  generation,
  fusion,
  selection,
  result
}) {
  const lattice = result.lattice;
  return {
    providerId,
    regionId,
    boundsObservationIndex: observationIndex,
    status: result.status,
    reasons: cloneValue(result.reasons),
    sourceOuterBounds: cloneValue(boundsObservation),
    sourceBoundsSpace: createSourceBoundsSpace(boundsEvidenceRegion),
    primitivePeriodEvidence: cloneValue(primitivePeriodEvidence),
    pipeline: {
      candidateGeneration: {
        status: generation.status,
        candidateCount: generation.candidateSpace.exactCandidateCount,
        candidateSpace: cloneValue(generation.candidateSpace)
      },
      evidenceFusion: {
        status: fusion.status,
        confidenceArtifactCount: fusion.confidenceSpace.exactConfidenceCount,
        confidenceSpace: cloneValue(fusion.confidenceSpace)
      },
      candidateSelection: {
        status: selection.status,
        selectedCandidateId: selection.selectedCandidateId,
        selectedCandidateReference: cloneValue(
          selection.selectedCandidateReference
        ),
        competingCandidateIds:
          selection.competingCandidateSpace.exactCandidateCount === 0
            ? []
            : null,
        ambiguousCandidateIds: selection.status === "ambiguous" ? null : [],
        competingCandidateSpace: cloneValue(
          selection.competingCandidateSpace
        ),
        candidateEvaluationSpace: cloneValue(
          selection.candidateEvaluationSpace
        )
      },
      reconstructionResult: {
        status: result.status,
        sourceCandidateId: result.sourceCandidateId
      }
    },
    selectedRows: lattice?.gridDimensions?.rows ?? null,
    selectedCols: lattice?.gridDimensions?.cols ?? null,
    horizontalLinePositions: lattice?.axes?.horizontal?.positions?.slice() ?? [],
    verticalLinePositions: lattice?.axes?.vertical?.positions?.slice() ?? [],
    coordinateSystem: cloneValue(lattice?.coordinateSystem ?? null),
    reconstructionProvenance: cloneValue(result.reconstructionProvenance)
  };
}

function createUnavailableReconstruction({
  providerId,
  regionId,
  observationIndex = null,
  status,
  reason,
  sourceBoundsSpace = null
}) {
  return {
    providerId,
    regionId,
    boundsObservationIndex: observationIndex,
    status,
    reasons: [reason],
    sourceOuterBounds: null,
    sourceBoundsSpace,
    primitivePeriodEvidence: null,
    pipeline: null,
    selectedRows: null,
    selectedCols: null,
    horizontalLinePositions: [],
    verticalLinePositions: [],
    coordinateSystem: null,
    reconstructionProvenance: null
  };
}

function compareItem(item, annotation) {
  const filenameMatches = Boolean(
    annotation && item.filename !== null && annotation.filename === item.filename
  );
  const groundTruth = !annotation
    ? { status: "unavailable", reason: "ground-truth-annotation-unavailable" }
    : !filenameMatches
      ? {
        status: "unavailable",
        reason: "filename-mismatch",
        expectedFilename: annotation.filename,
        datasetFilename: item.filename
      }
      : {
        status: "available",
        rows: annotation.rows,
        cols: annotation.cols,
        horizontalLinePositions: annotation.horizontalLinePositions.slice(),
        verticalLinePositions: annotation.verticalLinePositions.slice()
      };
  const reconstructions = item.reconstructions.map(reconstruction => ({
    providerId: reconstruction.providerId,
    regionId: reconstruction.regionId,
    boundsObservationIndex: reconstruction.boundsObservationIndex,
    reconstruction,
    groundTruth: cloneValue(groundTruth),
    validation: createValidation(reconstruction, annotation, filenameMatches)
  }));

  return {
    itemId: item.itemId,
    filename: item.filename,
    status: reconstructions.some(value => value.validation.status === "compared")
      ? "compared"
      : "unavailable",
    sourceStatus: cloneValue(item.sourceStatus),
    groundTruth,
    reconstructions
  };
}

function createValidation(reconstruction, annotation, filenameMatches) {
  if (!annotation) {
    return unavailableValidation("ground-truth-annotation-unavailable");
  }
  if (!filenameMatches) {
    return unavailableValidation("filename-mismatch");
  }
  if (reconstruction.status !== "available") {
    return unavailableValidation("grid-lattice-reconstruction-unavailable");
  }

  const horizontal = compareAxisLines(
    annotation.horizontalLinePositions,
    reconstruction.horizontalLinePositions
  );
  const vertical = compareAxisLines(
    annotation.verticalLinePositions,
    reconstruction.verticalLinePositions
  );
  const rows = compareCount(annotation.rows, reconstruction.selectedRows);
  const cols = compareCount(annotation.cols, reconstruction.selectedCols);
  const allDeltas = [
    ...horizontal.perExpectedLine,
    ...vertical.perExpectedLine
  ].flatMap(value => value.signedDelta === null ? [] : [value.signedDelta]);

  return {
    status: "compared",
    rows,
    cols,
    exactDimensionMatch: rows.exact && cols.exact,
    horizontalLines: horizontal,
    verticalLines: vertical,
    missingReconstructedLines: {
      horizontal: cloneValue(horizontal.missingReconstructedLines),
      vertical: cloneValue(vertical.missingReconstructedLines)
    },
    extraReconstructedLines: {
      horizontal: cloneValue(horizontal.extraReconstructedLines),
      vertical: cloneValue(vertical.extraReconstructedLines)
    },
    linePositionError: createErrorStatistics(allDeltas)
  };
}

function compareAxisLines(expected, reconstructed) {
  const exact = compareLinePositions(expected, reconstructed);
  const perExpectedLine = exact.nearestObservedByExpected.map(value => ({
    groundTruthLineIndex: value.expectedIndex,
    groundTruthPosition: value.expectedPosition,
    reconstructedLineIndex: value.observedIndex,
    reconstructedPosition: value.observedPosition,
    signedDelta: value.delta,
    absoluteDelta: value.delta === null ? null : Math.abs(value.delta),
    exactMatch: value.delta === 0
  }));
  const deltas = perExpectedLine.flatMap(value => (
    value.signedDelta === null ? [] : [value.signedDelta]
  ));

  return {
    status: "compared",
    equality: "exact-numeric-equality",
    groundTruthLinePositions: expected.slice(),
    reconstructedLinePositions: reconstructed.slice(),
    exact: exact.exact,
    perExpectedLine,
    exactMatches: cloneValue(exact.exactMatches),
    missingReconstructedLines: cloneValue(exact.missingExpected),
    extraReconstructedLines: cloneValue(exact.extraObserved),
    nearestGroundTruthByReconstructed: cloneValue(
      exact.nearestExpectedByObserved
    ),
    error: createErrorStatistics(deltas)
  };
}

function createErrorStatistics(deltas) {
  if (deltas.length === 0) {
    return {
      status: "unavailable",
      sampleCount: 0,
      maximumAbsoluteError: null,
      rmsError: null
    };
  }
  return {
    status: "available",
    sampleCount: deltas.length,
    maximumAbsoluteError: Math.max(...deltas.map(Math.abs)),
    rmsError: Math.sqrt(
      deltas.reduce((sum, value) => sum + value * value, 0) / deltas.length
    )
  };
}

function unavailableValidation(reason) {
  return {
    status: "unavailable",
    reason,
    rows: null,
    cols: null,
    exactDimensionMatch: null,
    horizontalLines: null,
    verticalLines: null,
    missingReconstructedLines: { horizontal: [], vertical: [] },
    extraReconstructedLines: { horizontal: [], vertical: [] },
    linePositionError: createErrorStatistics([])
  };
}

function compareCount(expected, reconstructed) {
  return {
    groundTruth: expected,
    reconstructed,
    delta: reconstructed - expected,
    exact: reconstructed === expected
  };
}

function createPrimitivePeriodEvidence({
  providerId,
  regionId,
  reconstructionRegion,
  transform
}) {
  const strategy = reconstructionRegion?.reconstruction?.diagnostics?.find(
    diagnostic => diagnostic?.type === STRATEGY_DIAGNOSTIC_TYPE
  );
  const axes = {
    horizontal: createPeriodAxis(
      "horizontal",
      strategy?.axes?.horizontal,
      transform.scaleY,
      providerId,
      regionId
    ),
    vertical: createPeriodAxis(
      "vertical",
      strategy?.axes?.vertical,
      transform.scaleX,
      providerId,
      regionId
    )
  };

  return {
    id: `primitive-period-evidence:${providerId}:${regionId}`,
    status: axes.horizontal.status === "unavailable"
      || axes.vertical.status === "unavailable"
      ? "unavailable"
      : axes.horizontal.status === "ambiguous"
        || axes.vertical.status === "ambiguous"
        ? "ambiguous"
        : "available",
    axes,
    evidenceReferences: [
      `${RECONSTRUCTION_EXPERIMENT_ID}:${providerId}:${regionId}`
    ],
    provenance: {
      source: RECONSTRUCTION_EXPERIMENT_ID,
      evidence: "pre-admission-axis-interpretation-derived-spacing"
    }
  };
}

function createPeriodAxis(axis, diagnostic, scale, providerId, regionId) {
  const candidates = [];
  const seen = new Set();
  for (const [interpretationIndex, interpretation] of (
    diagnostic?.interpretations ?? []
  ).entries()) {
    const period = interpretation?.derivedSpacing * scale;
    if (!Number.isFinite(period) || period <= 0 || seen.has(String(period))) {
      continue;
    }
    seen.add(String(period));
    candidates.push({
      id: `${axis}-period-${String(candidates.length + 1).padStart(3, "0")}`,
      period,
      evidenceReferences: [
        `${RECONSTRUCTION_EXPERIMENT_ID}:${providerId}:${regionId}:${axis}:${interpretationIndex}`
      ],
      provenance: {
        source: RECONSTRUCTION_EXPERIMENT_ID,
        providerId,
        regionId,
        axis,
        interpretationIndex,
        interpretationStatus: interpretation?.status ?? "rejected",
        rejectionReasons: cloneValue(interpretation?.rejectionReasons ?? [])
      }
    });
  }
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

function createAxisEvidence(axis, positions) {
  return {
    axis,
    status: positions.length === 0 ? "unavailable" : "available",
    positions,
    spacingObservations: positions.slice(1).map((position, index) => ({
      fromPosition: positions[index],
      toPosition: position,
      spacing: position - positions[index]
    })),
    evidenceReferences: [`${GRID_ANALYSIS_EXPERIMENT_ID}:${axis}`],
    diagnostics: []
  };
}

function normalizeCandidatePositions(gridRegion, transform) {
  return {
    horizontal: (gridRegion?.candidatePositions?.horizontal ?? []).map(
      position => transform.offsetY + position * transform.scaleY
    ),
    vertical: (gridRegion?.candidatePositions?.vertical ?? []).map(
      position => transform.offsetX + position * transform.scaleX
    )
  };
}

function readGridRegionTransform(
  gridRegion,
  reconstructionRegion,
  boundsEvidenceRegion
) {
  const provenanceTransform = reconstructionRegion?.coordinateProvenance
    ?.localToBinaryImage;
  const boundsSourceTransform = boundsEvidenceRegion?.sourceCoordinateSystem
    ?.localToBinaryImage;
  const transform = provenanceTransform ?? boundsSourceTransform ?? {
    offsetX: gridRegion?.regionBounds?.left,
    offsetY: gridRegion?.regionBounds?.top,
    scaleX: 1,
    scaleY: 1
  };
  if (!transform || ["offsetX", "offsetY", "scaleX", "scaleY"].some(key => (
    !Number.isFinite(transform[key])
  ))) {
    throw new Error("Grid Analysis coordinate transform is unavailable");
  }
  return transform;
}

function renderedCoordinateSystem() {
  return {
    space: "rendered-binary-image-pixels",
    unit: "pixel",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center"
  };
}

function readExperiment(item, id) {
  const experiment = item?.comparison?.result?.benchmark?.experiments?.find(
    value => value?.id === id
  );
  return experiment?.success === true ? experiment.diagnostics : null;
}

function findById(values, id) {
  return Array.isArray(values)
    ? values.find(value => (value?.id ?? value?.providerId) === id)
    : null;
}

function findRegion(values, regionId) {
  return Array.isArray(values)
    ? values.find(value => value?.regionId === regionId)
    : null;
}

function validateDatasetReport(datasetReport) {
  if (
    datasetReport?.type !== "digitization-dataset-report"
    || datasetReport?.version !== 1
    || typeof datasetReport?.datasetRun?.datasetId !== "string"
    || !Array.isArray(datasetReport?.items)
  ) {
    throw new Error("datasetReport must be a version 1 digitization dataset report");
  }
}

function validateGroundTruth(groundTruth, datasetId) {
  if (
    groundTruth?.type !== "digitization-grid-ground-truth"
    || groundTruth?.version !== 1
    || groundTruth?.datasetId !== datasetId
    || !Array.isArray(groundTruth?.annotations)
  ) {
    throw new Error("groundTruth must match the dataset report");
  }
}

function normalizeError(error) {
  return error instanceof Error ? error.message : String(error);
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
