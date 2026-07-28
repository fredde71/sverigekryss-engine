export const DEFAULT_BINARY_THRESHOLD = 128;
export const ALPHA_HANDLING = "composite-transparent-over-white";

export function createBinaryImage({
  width,
  height,
  data,
  threshold = DEFAULT_BINARY_THRESHOLD,
  alphaHandling = ALPHA_HANDLING
}) {
  return {
    width,
    height,
    data,
    threshold,
    alphaHandling
  };
}

export function thresholdRgbaImage(imageData, options = {}) {
  const threshold = normalizeThreshold(options.threshold);
  const width = imageData?.width;
  const height = imageData?.height;
  const source = imageData?.data;

  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("ImageData width and height are required");
  }

  if (!source || source.length < width * height * 4) {
    throw new Error("RGBA ImageData requires four channels per pixel");
  }

  const binary = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const alpha = source[offset + 3] / 255;
    const red = compositeOverWhite(source[offset], alpha);
    const green = compositeOverWhite(source[offset + 1], alpha);
    const blue = compositeOverWhite(source[offset + 2], alpha);
    const luminance = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);

    binary[i] = luminance <= threshold ? 1 : 0;
  }

  return createBinaryImage({
    width,
    height,
    data: binary,
    threshold,
    alphaHandling: ALPHA_HANDLING
  });
}

function compositeOverWhite(channel, alpha) {
  return (channel * alpha) + (255 * (1 - alpha));
}

function normalizeThreshold(threshold) {
  if (!Number.isFinite(threshold)) {
    return DEFAULT_BINARY_THRESHOLD;
  }

  return Math.max(0, Math.min(255, threshold));
}
