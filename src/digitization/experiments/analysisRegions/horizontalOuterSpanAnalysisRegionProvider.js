import {
  observeHorizontalOuterSpanAnalysisRegion as observeAnalysisRegion
} from "../../analysis/HorizontalOuterSpanAnalysisRegion";

const PROVIDER_ID = "horizontal-outer-span";

export const horizontalOuterSpanAnalysisRegionProvider = Object.freeze({
  id: PROVIDER_ID,
  description: "Observe a full-width vertical span from the outermost qualifying horizontal candidate runs.",
  run(documentAnalysis) {
    return observeHorizontalOuterSpanAnalysisRegion(documentAnalysis);
  }
});

export function observeHorizontalOuterSpanAnalysisRegion(documentAnalysis) {
  return observeAnalysisRegion(documentAnalysis, {
    regionId: `${PROVIDER_ID}-001`,
    regionType: "shadow-observation"
  });
}
