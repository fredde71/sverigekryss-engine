import { horizontalOuterSpanAnalysisRegionProvider } from "./horizontalOuterSpanAnalysisRegionProvider";

const SHADOW_ANALYSIS_REGION_PROVIDERS = Object.freeze([
  horizontalOuterSpanAnalysisRegionProvider
]);

export function listShadowAnalysisRegionProviders() {
  return SHADOW_ANALYSIS_REGION_PROVIDERS.slice();
}
