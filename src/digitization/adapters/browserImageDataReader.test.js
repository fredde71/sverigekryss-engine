import {
  readBrowserImageData,
  readCanvasImageData
} from "./browserImageDataReader";

test("readCanvasImageData returns plain ImageData with cloned pixel data", () => {
  const pixels = new Uint8ClampedArray([
    0, 1, 2, 255,
    3, 4, 5, 255
  ]);
  const getImageData = jest.fn(() => ({
    width: 2,
    height: 1,
    data: pixels
  }));
  const canvas = createCanvas({
    width: 2,
    height: 1,
    context: {
      getImageData
    }
  });

  const result = readCanvasImageData(canvas);

  pixels[0] = 99;

  expect(getImageData).toHaveBeenCalledWith(0, 0, 2, 1);
  expect(result).toEqual({
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([
      0, 1, 2, 255,
      3, 4, 5, 255
    ])
  });
  expect(result.data instanceof Uint8ClampedArray).toBe(true);
});

test("readBrowserImageData reads directly from a canvas source", async () => {
  const canvas = createCanvas({
    width: 1,
    height: 1,
    context: {
      getImageData: jest.fn(() => ({
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([7, 8, 9, 255])
      }))
    }
  });

  await expect(readBrowserImageData(canvas)).resolves.toEqual({
    width: 1,
    height: 1,
    data: new Uint8ClampedArray([7, 8, 9, 255])
  });
});

test("readBrowserImageData reads image data URLs with injected browser primitives", async () => {
  const imageSrc = "data:image/png;base64,AAAA";
  const pixels = new Uint8ClampedArray([
    10, 11, 12, 255,
    13, 14, 15, 255,
    16, 17, 18, 255,
    19, 20, 21, 255
  ]);
  const drawImage = jest.fn();
  const getImageData = jest.fn(() => ({
    width: 2,
    height: 2,
    data: pixels
  }));
  const canvas = createCanvas({
    width: 0,
    height: 0,
    context: {
      drawImage,
      getImageData
    }
  });
  const documentRef = {
    createElement: jest.fn(() => canvas)
  };
  const ImageCtor = createAsyncImageCtor({
    naturalWidth: 2,
    naturalHeight: 2
  });

  const result = await readBrowserImageData(imageSrc, {
    ImageCtor,
    documentRef
  });

  pixels[0] = 99;

  expect(documentRef.createElement).toHaveBeenCalledWith("canvas");
  expect(canvas.width).toBe(2);
  expect(canvas.height).toBe(2);
  expect(drawImage).toHaveBeenCalledWith(expect.any(ImageCtor), 0, 0, 2, 2);
  expect(getImageData).toHaveBeenCalledWith(0, 0, 2, 2);
  expect(result).toEqual({
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      10, 11, 12, 255,
      13, 14, 15, 255,
      16, 17, 18, 255,
      19, 20, 21, 255
    ])
  });
});

test("readBrowserImageData accepts object sources with imageSrc data URLs", async () => {
  const canvas = createCanvas({
    width: 0,
    height: 0,
    context: {
      drawImage: jest.fn(),
      getImageData: jest.fn(() => ({
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([1, 2, 3, 255])
      }))
    }
  });

  const result = await readBrowserImageData({
    imageSrc: "data:image/png;base64,AAAA"
  }, {
    ImageCtor: createAsyncImageCtor({
      naturalWidth: 1,
      naturalHeight: 1
    }),
    documentRef: {
      createElement: jest.fn(() => canvas)
    }
  });

  expect(result.data instanceof Uint8ClampedArray).toBe(true);
  expect(Array.from(result.data)).toEqual([1, 2, 3, 255]);
});

test("readBrowserImageData rejects unsupported sources without filesystem access", async () => {
  await expect(readBrowserImageData({
    path: "/tmp/source.png"
  })).rejects.toThrow("Unsupported browser image source");
});

test("readCanvasImageData validates ImageData shape", () => {
  expect(() => readCanvasImageData(createCanvas({
    width: 1,
    height: 1,
    context: {
      getImageData: () => ({
        width: 1,
        height: 1,
        data: new Uint8Array([1, 2, 3, 4])
      })
    }
  }))).toThrow("ImageData data must be a Uint8ClampedArray");
});

function createCanvas({
  width,
  height,
  context
}) {
  return {
    width,
    height,
    getContext: jest.fn(() => context)
  };
}

function createAsyncImageCtor({
  naturalWidth,
  naturalHeight
}) {
  return class FakeImage {
    constructor() {
      this.naturalWidth = naturalWidth;
      this.naturalHeight = naturalHeight;
    }

    set src(value) {
      this._src = value;
      setTimeout(() => this.onload(), 0);
    }

    get src() {
      return this._src;
    }
  };
}
