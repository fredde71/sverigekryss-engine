import {
  DEFAULT_DOCUMENT_SIZE,
  getDocumentSizeForDimensions,
  getFullDocumentArea,
  loadImageDocumentSize,
  normalizeDocumentSize
} from "./documentGeometry";

test("portrait PDF dimensions normalize to width 1200 and height greater than 1200", () => {
  const documentSize = getDocumentSizeForDimensions({
    width: 1000,
    height: 1414
  });

  expect(documentSize).toEqual({
    width: 1200,
    height: 1697
  });
  expect(documentSize.height).toBeGreaterThan(1200);
});

test("landscape image dimensions produce proportional normalized height", () => {
  expect(
    getDocumentSizeForDimensions({
      width: 1600,
      height: 900
    })
  ).toEqual({
    width: 1200,
    height: 675
  });
});

test("square image dimensions remain 1200 by 1200", () => {
  expect(
    getDocumentSizeForDimensions({
      width: 800,
      height: 800
    })
  ).toEqual(DEFAULT_DOCUMENT_SIZE);
});

test("legacy missing documentSize normalizes to the default", () => {
  expect(normalizeDocumentSize(undefined)).toEqual(DEFAULT_DOCUMENT_SIZE);
});

test("cropArea can initialize to the full document height", () => {
  expect(
    getFullDocumentArea({
      width: 1200,
      height: 1697
    })
  ).toEqual({
    top: 0,
    left: 0,
    width: 1200,
    height: 1697
  });
});

test("image uploads can read natural dimensions", async () => {
  class FakeImage {
    naturalWidth = 1600;
    naturalHeight = 900;

    set src(value) {
      this._src = value;
      this.onload();
    }
  }

  await expect(loadImageDocumentSize("data:image/png;base64,AAAA", FakeImage))
    .resolves
    .toEqual({
      width: 1200,
      height: 675
    });
});
