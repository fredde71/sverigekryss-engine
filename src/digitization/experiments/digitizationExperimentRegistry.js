import { verticalContinuityDiagnosticsExperiment } from "./verticalContinuityDiagnostics";
import { verticalLineMaskDiagnosticsExperiment } from "./verticalLineMaskDiagnostics";
import { gridConfidenceDiagnosticsExperiment } from "./gridConfidenceDiagnostics";
import { verticalContinuityCandidateDiagnosticsExperiment } from "./verticalContinuityCandidateDiagnostics";
import { verticalCandidateCoverageThresholdDiagnosticsExperiment } from "./verticalCandidateCoverageThresholdDiagnostics";
import { verticalSpanRelativeCoverageDiagnosticsExperiment } from "./verticalSpanRelativeCoverageDiagnostics";
import { shadowAnalysisRegionDiagnosticsExperiment } from "./shadowAnalysisRegionDiagnostics";
import { shadowGridAnalysisDiagnosticsExperiment } from "./shadowGridAnalysisDiagnostics";
import { shadowGridBoundsObservationDiagnosticsExperiment } from "./shadowGridBoundsObservationDiagnostics";
import { shadowOuterLineCenterObservationDiagnosticsExperiment } from "./shadowOuterLineCenterObservationDiagnostics";
import { shadowOuterLineCenterNeighborhoodDiagnosticsExperiment } from "./shadowOuterLineCenterNeighborhoodDiagnostics";
import { shadowGridReconstructionDiagnosticsExperiment } from "./shadowGridReconstructionDiagnostics";
import { shadowGridBoundsLatticeExtensionDiagnosticsExperiment } from "./shadowGridBoundsLatticeExtensionDiagnostics";

const DIGITIZATION_EXPERIMENTS = Object.freeze([
  verticalLineMaskDiagnosticsExperiment,
  verticalContinuityDiagnosticsExperiment,
  verticalContinuityCandidateDiagnosticsExperiment,
  verticalCandidateCoverageThresholdDiagnosticsExperiment,
  verticalSpanRelativeCoverageDiagnosticsExperiment,
  shadowAnalysisRegionDiagnosticsExperiment,
  shadowGridAnalysisDiagnosticsExperiment,
  shadowGridBoundsObservationDiagnosticsExperiment,
  shadowOuterLineCenterObservationDiagnosticsExperiment,
  shadowOuterLineCenterNeighborhoodDiagnosticsExperiment,
  shadowGridReconstructionDiagnosticsExperiment,
  shadowGridBoundsLatticeExtensionDiagnosticsExperiment,
  gridConfidenceDiagnosticsExperiment
]);

const DIGITIZATION_EXPERIMENTS_BY_ID = createExperimentIndex(
  DIGITIZATION_EXPERIMENTS
);

export function listDigitizationExperiments() {
  return DIGITIZATION_EXPERIMENTS.slice();
}

export function getDigitizationExperiment(id) {
  return DIGITIZATION_EXPERIMENTS_BY_ID.get(id) ?? null;
}

export function runDigitizationExperiment(id, binaryImage, context = {}) {
  const experiment = getDigitizationExperiment(id);

  if (!experiment) {
    throw new Error(`Unknown digitization experiment: ${id}`);
  }

  return experiment.run(binaryImage, context);
}

function createExperimentIndex(experiments) {
  const experimentsById = new Map();

  for (const experiment of experiments) {
    validateExperiment(experiment);

    if (experimentsById.has(experiment.id)) {
      throw new Error(`Duplicate digitization experiment id: ${experiment.id}`);
    }

    experimentsById.set(experiment.id, experiment);
  }

  return experimentsById;
}

function validateExperiment(experiment) {
  if (!experiment || typeof experiment !== "object") {
    throw new Error("Digitization experiment must be an object");
  }

  if (typeof experiment.id !== "string" || experiment.id.length === 0) {
    throw new Error("Digitization experiment id must be a non-empty string");
  }

  if (typeof experiment.description !== "string" || experiment.description.length === 0) {
    throw new Error(`Digitization experiment ${experiment.id} requires a description`);
  }

  if (typeof experiment.run !== "function") {
    throw new Error(`Digitization experiment ${experiment.id} requires a run function`);
  }
}
