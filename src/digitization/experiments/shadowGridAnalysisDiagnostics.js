import { createGridAnalysis } from "../analysis/GridAnalysis";
import { createShadowAnalysisRegionDiagnostics } from "./shadowAnalysisRegionDiagnostics";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);

export const shadowGridAnalysisDiagnosticsExperiment = Object.freeze({
  id: "shadow-grid-analysis-diagnostics",
  description: "Run region-local GridAnalysis over development-only shadow AnalysisRegions.",
  run(binaryImage, _context) {
    return runShadowGridAnalysisDiagnostics(binaryImage);
  }
});

export function createShadowGridAnalysisDiagnosticsRunner({
  observeRegions = createShadowAnalysisRegionDiagnostics,
  analyzeGrid = createGridAnalysis,
  now = readCurrentTime,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  validateDependency(observeRegions, "observeRegions");
  validateDependency(analyzeGrid, "analyzeGrid");
  validateDependency(now, "now");
  validateDependency(readEnvironment, "readEnvironment");

  return async function run(binaryImage) {
    assertDevelopmentEnvironment(readEnvironment());

    const regionObservations = await observeRegions(binaryImage);
    const providers = Array.isArray(regionObservations?.providers)
      ? regionObservations.providers
      : [];
    const providerResults = [];

    for (const provider of providers) {
      providerResults.push(await analyzeProviderRegions(provider, {
        analyzeGrid,
        now
      }));
    }

    return {
      type: "shadow-grid-analysis-diagnostics",
      version: 1,
      status: "complete",
      providers: providerResults
    };
  };
}

export const runShadowGridAnalysisDiagnostics =
  createShadowGridAnalysisDiagnosticsRunner();

async function analyzeProviderRegions(provider, dependencies) {
  const regions = Array.isArray(provider?.regions) ? provider.regions : [];
  const result = {
    id: provider?.id,
    description: provider?.description,
    status: provider?.status,
    regionCount: Number.isInteger(provider?.regionCount)
      ? provider.regionCount
      : regions.length,
    reason: cloneValue(provider?.reason ?? null),
    gridAnalyses: []
  };

  if (provider?.status !== "available") {
    return result;
  }

  for (const region of regions) {
    result.gridAnalyses.push(await analyzeRegion(provider.id, region, dependencies));
  }

  return result;
}

async function analyzeRegion(providerId, region, {
  analyzeGrid,
  now
}) {
  const startTime = now();

  try {
    const gridAnalysis = await analyzeGrid({ analysisRegion: region });

    return createCompletedRegionObservation({
      providerId,
      region,
      gridAnalysis,
      durationMs: createDuration(startTime, now())
    });
  } catch (error) {
    return {
      providerId,
      regionId: region?.id,
      regionBounds: cloneValue(region?.bounds ?? null),
      regionDimensions: cloneValue(region?.dimensions ?? null),
      status: "failed",
      gridAnalysisStatus: "failed",
      durationMs: createDuration(startTime, now()),
      candidateCounts: {
        horizontal: null,
        vertical: null
      },
      candidatePositions: {
        horizontal: null,
        vertical: null
      },
      spacingDiagnostics: [],
      geometry: {
        status: "unavailable",
        rows: null,
        cols: null,
        bounds: null
      },
      rejectionReasons: [],
      error: normalizeError(error)
    };
  }
}

function createCompletedRegionObservation({
  providerId,
  region,
  gridAnalysis,
  durationMs
}) {
  const horizontalCandidates = Array.isArray(gridAnalysis?.lineCandidates?.horizontal)
    ? gridAnalysis.lineCandidates.horizontal
    : [];
  const verticalCandidates = Array.isArray(gridAnalysis?.lineCandidates?.vertical)
    ? gridAnalysis.lineCandidates.vertical
    : [];
  const geometry = gridAnalysis?.gridGeometry;

  return {
    providerId,
    regionId: region?.id,
    regionBounds: cloneValue(region?.bounds ?? null),
    regionDimensions: cloneValue(
      region?.dimensions
      ?? gridAnalysis?.analysisDimensions
      ?? null
    ),
    status: "completed",
    gridAnalysisStatus: gridAnalysis?.status ?? null,
    durationMs,
    candidateCounts: {
      horizontal: horizontalCandidates.length,
      vertical: verticalCandidates.length
    },
    candidatePositions: {
      horizontal: horizontalCandidates.map(candidate => candidate.position),
      vertical: verticalCandidates.map(candidate => candidate.position)
    },
    spacingDiagnostics: extractSpacingDiagnostics(gridAnalysis?.diagnostics),
    geometry: geometry
      ? {
        status: "available",
        rows: geometry.rows,
        cols: geometry.cols,
        bounds: cloneValue(geometry.bounds)
      }
      : {
        status: "unavailable",
        rows: null,
        cols: null,
        bounds: null
      },
    rejectionReasons: geometry
      ? []
      : extractRejectionReasons(gridAnalysis?.diagnostics),
    error: null
  };
}

function extractSpacingDiagnostics(diagnostics) {
  return Array.isArray(diagnostics)
    ? diagnostics
      .filter(diagnostic => diagnostic?.type === "spacing-consistency")
      .map(cloneValue)
    : [];
}

function extractRejectionReasons(diagnostics) {
  if (!Array.isArray(diagnostics)) {
    return [];
  }

  const reasons = [];

  for (const diagnostic of diagnostics) {
    if (diagnostic?.type === "rejection-reason") {
      const reason = cloneValue(diagnostic);
      delete reason.type;
      reasons.push(reason);
    }

    if (
      diagnostic?.type === "rejection-reasons"
      && Array.isArray(diagnostic.reasons)
    ) {
      reasons.push(...diagnostic.reasons.map(cloneValue));
    }
  }

  return reasons;
}

function createDuration(startTime, endTime) {
  const duration = endTime - startTime;

  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

function readCurrentTime() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Shadow GridAnalysis is available only in development or test"
    );
  }
}

function normalizeError(error) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error)
  };
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneValue(nestedValue)])
    );
  }

  return value;
}

function validateDependency(dependency, name) {
  if (typeof dependency !== "function") {
    throw new Error(`${name} must be a function`);
  }
}
