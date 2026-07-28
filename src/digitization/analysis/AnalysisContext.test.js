import {
  createAnalysisContext,
  isReadOnlyTypedArray,
  withBinaryImage,
  withDiagnostic,
  withGridDetection,
  withGridGeometry,
  withImageData,
  withLineCandidates,
  withProjections
} from "./AnalysisContext";

test("createAnalysisContext creates the expected empty technical workspace", () => {
  expect(createAnalysisContext()).toEqual({
    imageData: null,
    binaryImage: null,
    projections: null,
    lineCandidates: null,
    gridGeometry: null,
    gridDetection: null,
    diagnostics: []
  });
});

test("createAnalysisContext freezes the context object", () => {
  const context = createAnalysisContext();

  expect(Object.isFrozen(context)).toBe(true);
});

test("withImageData returns a new context and does not mutate the previous one", () => {
  const context = createAnalysisContext();
  const next = withImageData(context, {
    width: 2,
    height: 1
  });

  expect(next).not.toBe(context);
  expect(context.imageData).toBeNull();
  expect(next.imageData).toEqual({
    width: 2,
    height: 1
  });
});

test("context updates keep nested objects immutable", () => {
  const context = withGridGeometry(createAnalysisContext(), {
    bounds: {
      top: 10,
      left: 20,
      width: 300,
      height: 400
    }
  });

  expect(Object.isFrozen(context.gridGeometry)).toBe(true);
  expect(Object.isFrozen(context.gridGeometry.bounds)).toBe(true);
});

test("context updates clone nested objects so later input mutation cannot leak in", () => {
  const gridGeometry = {
    bounds: {
      top: 10,
      left: 20,
      width: 300,
      height: 400
    }
  };

  const context = withGridGeometry(createAnalysisContext(), gridGeometry);

  gridGeometry.bounds.top = 99;

  expect(context.gridGeometry.bounds.top).toBe(10);
});

test("all named update helpers preserve previous values", () => {
  const context = createAnalysisContext();
  const imageData = { width: 2, height: 2 };
  const binaryImage = { width: 2, height: 2 };
  const projections = { horizontal: [1], vertical: [2] };
  const lineCandidates = { horizontal: [{ position: 1 }], vertical: [] };
  const gridGeometry = { bounds: { top: 0, left: 0, width: 2, height: 2 } };
  const gridDetection = { geometry: gridGeometry, confidence: "test" };

  const next = withGridDetection(
    withGridGeometry(
      withLineCandidates(
        withProjections(
          withBinaryImage(
            withImageData(context, imageData),
            binaryImage
          ),
          projections
        ),
        lineCandidates
      ),
      gridGeometry
    ),
    gridDetection
  );

  expect(next).toMatchObject({
    imageData,
    binaryImage,
    projections,
    lineCandidates,
    gridGeometry,
    gridDetection
  });
});

test("withDiagnostic appends diagnostics immutably", () => {
  const context = withDiagnostic(createAnalysisContext(), "first");
  const next = withDiagnostic(context, "second");

  expect(context.diagnostics).toEqual(["first"]);
  expect(next.diagnostics).toEqual(["first", "second"]);
  expect(Object.isFrozen(next.diagnostics)).toBe(true);
});

test("typed arrays are copied and exposed through a read-only contract", () => {
  const pixels = new Uint8ClampedArray([0, 255, 128]);
  const context = withImageData(createAnalysisContext(), {
    width: 1,
    height: 1,
    data: pixels
  });

  pixels[0] = 99;

  expect(context.imageData.data[0]).toBe(0);
  expect(isReadOnlyTypedArray(context.imageData.data)).toBe(false);
});

test("typed array reads return normal typed arrays", () => {
  const context = withImageData(createAnalysisContext(), {
    data: new Uint8Array([1, 2, 3])
  });
  const data = context.imageData.data;

  expect(data instanceof Uint8Array).toBe(true);
  expect(ArrayBuffer.isView(data)).toBe(true);
  expect([...data]).toEqual([1, 2, 3]);
  expect(Array.from(data.slice(1))).toEqual([2, 3]);
  expect(Array.from(data.subarray(1))).toEqual([2, 3]);
});

test("typed array element writes mutate only the defensive copy", () => {
  const context = withImageData(createAnalysisContext(), {
    data: new Uint8Array([1, 2, 3])
  });
  const data = context.imageData.data;

  data[0] = 9;

  expect(data[0]).toBe(9);
  expect(context.imageData.data[0]).toBe(1);
});

test("typed array mutating methods mutate only the defensive copy", () => {
  const context = withImageData(createAnalysisContext(), {
    data: new Uint8Array([1, 2, 3, 4])
  });

  const setCopy = context.imageData.data;
  setCopy.set([9], 0);
  expect(Array.from(context.imageData.data)).toEqual([1, 2, 3, 4]);

  const fillCopy = context.imageData.data;
  fillCopy.fill(7);
  expect(Array.from(context.imageData.data)).toEqual([1, 2, 3, 4]);

  const copyWithinCopy = context.imageData.data;
  copyWithinCopy.copyWithin(1, 0, 1);
  expect(Array.from(context.imageData.data)).toEqual([1, 2, 3, 4]);

  const reverseCopy = context.imageData.data;
  reverseCopy.reverse();
  expect(Array.from(context.imageData.data)).toEqual([1, 2, 3, 4]);

  const sortCopy = withImageData(createAnalysisContext(), {
    data: new Uint8Array([2, 1, 3])
  });
  const sortedData = sortCopy.imageData.data;
  sortedData.sort();
  expect(Array.from(sortCopy.imageData.data)).toEqual([2, 1, 3]);
});

test("typed array subarray mutates only the defensive copy backing store", () => {
  const context = withImageData(createAnalysisContext(), {
    data: new Uint8Array([1, 2, 3])
  });
  const view = context.imageData.data.subarray(0, 1);

  view[0] = 9;

  expect(view[0]).toBe(9);
  expect(context.imageData.data[0]).toBe(1);
});

test("typed array buffer mutation cannot mutate context state", () => {
  const context = withBinaryImage(createAnalysisContext(), {
    data: new Uint8Array([1, 2, 3])
  });
  const data = context.binaryImage.data;

  new Uint8Array(data.buffer)[0] = 9;

  expect(data[0]).toBe(9);
  expect(context.binaryImage.data[0]).toBe(1);
});

test("typed array property definition mutates only the defensive copy", () => {
  const context = withImageData(createAnalysisContext(), {
    data: new Uint8Array([1, 2, 3])
  });
  const data = context.imageData.data;

  Object.defineProperty(data, "0", {
    value: 9
  });

  expect(data[0]).toBe(9);
  expect(context.imageData.data[0]).toBe(1);
});

test("typed array delete attempts do not mutate context state", () => {
  const context = withImageData(createAnalysisContext(), {
    data: new Uint8Array([1, 2, 3])
  });
  const data = context.imageData.data;

  expect(() => {
    delete data[0];
  }).toThrow();
  expect(context.imageData.data[0]).toBe(1);
});

test("typed arrays remain typed arrays when an existing context is extended", () => {
  const context = withImageData(createAnalysisContext(), {
    data: new Uint8Array([1, 2, 3])
  });
  const next = withGridGeometry(context, {
    bounds: {
      top: 0,
      left: 0,
      width: 10,
      height: 10
    }
  });

  expect(next.imageData.data instanceof Uint8Array).toBe(true);
  expect(ArrayBuffer.isView(next.imageData.data)).toBe(true);
  expect(Array.from(next.imageData.data)).toEqual([1, 2, 3]);
});

test("typed arrays nested in arrays are exposed as defensive copies", () => {
  const context = withProjections(createAnalysisContext(), {
    rows: [
      new Uint16Array([1, 2, 3])
    ]
  });
  const row = context.projections.rows[0];

  row[0] = 9;

  expect(row instanceof Uint16Array).toBe(true);
  expect(ArrayBuffer.isView(row)).toBe(true);
  expect(context.projections.rows[0][0]).toBe(1);
});
