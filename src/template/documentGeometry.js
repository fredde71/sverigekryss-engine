export const DEFAULT_DOCUMENT_SIZE = {
  width: 1200,
  height: 1200
};

export function normalizeDocumentSize(documentSize) {
  if (
    !documentSize ||
    !Number.isFinite(documentSize.width) ||
    !Number.isFinite(documentSize.height) ||
    documentSize.width <= 0 ||
    documentSize.height <= 0
  ) {
    return DEFAULT_DOCUMENT_SIZE;
  }

  return {
    width: documentSize.width,
    height: documentSize.height
  };
}

export function getDocumentSizeForDimensions({
  width,
  height
}) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return DEFAULT_DOCUMENT_SIZE;
  }

  return {
    width: DEFAULT_DOCUMENT_SIZE.width,
    height: Math.round(height * (DEFAULT_DOCUMENT_SIZE.width / width))
  };
}

export function getFullDocumentArea(documentSize) {
  const safeDocumentSize = normalizeDocumentSize(documentSize);

  return {
    top: 0,
    left: 0,
    width: safeDocumentSize.width,
    height: safeDocumentSize.height
  };
}

export function loadImageDocumentSize(imageSrc, ImageCtor = Image) {
  return new Promise((resolve, reject) => {
    const image = new ImageCtor();

    image.onload = () => {
      resolve(getDocumentSizeForDimensions({
        width: image.naturalWidth,
        height: image.naturalHeight
      }));
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}
