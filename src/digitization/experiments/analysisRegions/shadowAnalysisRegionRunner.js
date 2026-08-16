import { listShadowAnalysisRegionProviders } from "./shadowAnalysisRegionProviderRegistry";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);

export function createShadowAnalysisRegionRunner({
  listProviders = listShadowAnalysisRegionProviders,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  validateDependency(listProviders, "listProviders");
  validateDependency(readEnvironment, "readEnvironment");

  return function runShadowAnalysisRegionProviders(documentAnalysis) {
    assertDevelopmentEnvironment(readEnvironment());
    validateDocumentAnalysis(documentAnalysis);

    const providers = listProviders();

    if (!Array.isArray(providers)) {
      throw new Error("Shadow AnalysisRegion providers must be an array");
    }

    return {
      type: "shadow-analysis-region-observations",
      version: 1,
      status: "complete",
      providers: providers.map(provider => runProvider(provider, documentAnalysis))
    };
  };
}

export const runShadowAnalysisRegionProviders = createShadowAnalysisRegionRunner();

function runProvider(provider, documentAnalysis) {
  validateProvider(provider);

  try {
    const result = provider.run(documentAnalysis);

    validateProviderResult(provider.id, result);

    return {
      id: provider.id,
      description: provider.description,
      status: result.status,
      regionCount: result.regions.length,
      regions: result.regions,
      provenance: result.provenance ?? null,
      diagnostics: result.diagnostics ?? [],
      reason: result.reason ?? null
    };
  } catch (error) {
    return {
      id: provider.id,
      description: provider.description,
      status: "failed",
      regionCount: 0,
      regions: [],
      provenance: null,
      diagnostics: [],
      reason: normalizeError(error)
    };
  }
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Shadow AnalysisRegion providers are available only in development or test"
    );
  }
}

function validateDocumentAnalysis(documentAnalysis) {
  if (
    !documentAnalysis
    || documentAnalysis.type !== "document-analysis"
    || documentAnalysis.status !== "measured"
    || !documentAnalysis.binaryImage
  ) {
    throw new Error("Measured DocumentAnalysis is required");
  }
}

function validateProvider(provider) {
  if (
    !provider
    || typeof provider.id !== "string"
    || provider.id.length === 0
    || typeof provider.description !== "string"
    || provider.description.length === 0
    || typeof provider.run !== "function"
  ) {
    throw new Error("Invalid shadow AnalysisRegion provider");
  }
}

function validateProviderResult(providerId, result) {
  if (
    !result
    || !["available", "unavailable", "ambiguous"].includes(result.status)
    || !Array.isArray(result.regions)
    || !result.provenance
    || typeof result.provenance !== "object"
    || !Array.isArray(result.diagnostics)
    || (
      ["unavailable", "ambiguous"].includes(result.status)
      && typeof result.reason !== "string"
    )
  ) {
    throw new Error(`Invalid shadow AnalysisRegion result from ${providerId}`);
  }
}

function normalizeError(error) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error)
  };
}

function validateDependency(dependency, name) {
  if (typeof dependency !== "function") {
    throw new Error(`${name} must be a function`);
  }
}
