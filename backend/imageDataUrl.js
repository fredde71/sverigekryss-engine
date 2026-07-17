const SUPPORTED_IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};

const DATA_URL_PATTERN = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function parseImageDataUrl(imageSrc) {
  if (typeof imageSrc !== "string" || !imageSrc.startsWith("data:image")) {
    return null;
  }

  const match = DATA_URL_PATTERN.exec(imageSrc);

  if (!match) {
    throw new Error("Invalid image data");
  }

  const [, mimeType, payload] = match;
  const extension = SUPPORTED_IMAGE_TYPES[mimeType];

  if (!extension || !payload || !BASE64_PATTERN.test(payload)) {
    throw new Error("Invalid image data");
  }

  const buffer = Buffer.from(payload, "base64");

  if (buffer.length === 0) {
    throw new Error("Invalid image data");
  }

  return {
    mimeType,
    extension,
    buffer
  };
}

module.exports = {
  parseImageDataUrl
};
