export function createHorizontalProjection(binaryImage) {
  validateBinaryImage(binaryImage);

  const projection = new Uint32Array(binaryImage.height);

  for (let y = 0; y < binaryImage.height; y++) {
    let count = 0;

    for (let x = 0; x < binaryImage.width; x++) {
      count += binaryImage.data[(y * binaryImage.width) + x];
    }

    projection[y] = count;
  }

  return projection;
}

export function createVerticalProjection(binaryImage) {
  validateBinaryImage(binaryImage);

  const projection = new Uint32Array(binaryImage.width);

  for (let x = 0; x < binaryImage.width; x++) {
    let count = 0;

    for (let y = 0; y < binaryImage.height; y++) {
      count += binaryImage.data[(y * binaryImage.width) + x];
    }

    projection[x] = count;
  }

  return projection;
}

function validateBinaryImage(binaryImage) {
  const width = binaryImage?.width;
  const height = binaryImage?.height;
  const data = binaryImage?.data;

  if (!Number.isInteger(width) || width <= 0) {
    throw new Error("BinaryImage width must be a positive integer");
  }

  if (!Number.isInteger(height) || height <= 0) {
    throw new Error("BinaryImage height must be a positive integer");
  }

  if (!data || typeof data.length !== "number") {
    throw new Error("BinaryImage data is required");
  }

  if (data.length !== width * height) {
    throw new Error("BinaryImage data length must equal width * height");
  }

  for (let i = 0; i < data.length; i++) {
    if (data[i] !== 0 && data[i] !== 1) {
      throw new Error("BinaryImage data must contain only binary values 0 or 1");
    }
  }
}
