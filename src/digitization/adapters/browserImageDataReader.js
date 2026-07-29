export async function readBrowserImageData(source, {
  ImageCtor = Image,
  documentRef = document
} = {}) {
  if (isCanvasSource(source)) {
    return readCanvasImageData(source);
  }

  const imageSrc = getImageDataUrl(source);

  if (imageSrc) {
    return readImageDataUrl(imageSrc, {
      ImageCtor,
      documentRef
    });
  }

  throw new Error("Unsupported browser image source");
}

export function readCanvasImageData(canvas) {
  validateCanvas(canvas);

  const context = canvas.getContext("2d");

  if (!context || typeof context.getImageData !== "function") {
    throw new Error("Canvas 2D context is required");
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  return cloneImageData(imageData);
}

async function readImageDataUrl(imageSrc, {
  ImageCtor,
  documentRef
}) {
  if (typeof ImageCtor !== "function") {
    throw new Error("Image constructor is required");
  }

  if (!documentRef || typeof documentRef.createElement !== "function") {
    throw new Error("document.createElement is required");
  }

  const image = await loadImage(imageSrc, ImageCtor);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error("Loaded image dimensions are required");
  }

  const canvas = documentRef.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext?.("2d");

  if (!context || typeof context.drawImage !== "function" || typeof context.getImageData !== "function") {
    throw new Error("Canvas 2D context is required");
  }

  context.drawImage(image, 0, 0, width, height);

  return cloneImageData(context.getImageData(0, 0, width, height));
}

function loadImage(imageSrc, ImageCtor) {
  return new Promise((resolve, reject) => {
    const image = new ImageCtor();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = imageSrc;
  });
}

function cloneImageData(imageData) {
  const width = imageData?.width;
  const height = imageData?.height;
  const data = imageData?.data;

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error("ImageData width and height are required");
  }

  if (!(data instanceof Uint8ClampedArray)) {
    throw new Error("ImageData data must be a Uint8ClampedArray");
  }

  if (data.length !== width * height * 4) {
    throw new Error("ImageData data length must equal width * height * 4");
  }

  return {
    width,
    height,
    data: new Uint8ClampedArray(data)
  };
}

function getImageDataUrl(source) {
  if (typeof source === "string" && source.startsWith("data:image")) {
    return source;
  }

  if (typeof source?.imageSrc === "string" && source.imageSrc.startsWith("data:image")) {
    return source.imageSrc;
  }

  if (typeof source?.dataUrl === "string" && source.dataUrl.startsWith("data:image")) {
    return source.dataUrl;
  }

  return null;
}

function isCanvasSource(source) {
  return !!source
    && typeof source.getContext === "function"
    && Number.isFinite(source.width)
    && Number.isFinite(source.height);
}

function validateCanvas(canvas) {
  if (!Number.isFinite(canvas.width) || canvas.width <= 0) {
    throw new Error("Canvas width must be a positive number");
  }

  if (!Number.isFinite(canvas.height) || canvas.height <= 0) {
    throw new Error("Canvas height must be a positive number");
  }
}
