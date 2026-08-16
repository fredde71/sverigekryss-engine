import { runImageGridDetection } from "./imageGridDetectionOrchestrator";

export async function detectGridFromImageSource({
  source,
  options = {},
  readImageData
}) {
  return runImageGridDetection({
    source,
    options,
    readImageData
  });
}
