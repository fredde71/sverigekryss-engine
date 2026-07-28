import {
  createHorizontalProjection,
  createVerticalProjection
} from "./Projection";

test("createHorizontalProjection counts binary pixels per row", () => {
  const projection = createHorizontalProjection({
    width: 3,
    height: 2,
    data: new Uint8Array([
      1, 0, 1,
      0, 0, 1
    ])
  });

  expect(projection instanceof Uint32Array).toBe(true);
  expect(Array.from(projection)).toEqual([2, 1]);
});

test("createVerticalProjection counts binary pixels per column", () => {
  const projection = createVerticalProjection({
    width: 3,
    height: 2,
    data: new Uint8Array([
      1, 0, 1,
      0, 0, 1
    ])
  });

  expect(projection instanceof Uint32Array).toBe(true);
  expect(Array.from(projection)).toEqual([1, 0, 2]);
});

test("Projection validates BinaryImage dimensions", () => {
  expect(() => createHorizontalProjection({
    width: 0,
    height: 2,
    data: new Uint8Array(0)
  })).toThrow("BinaryImage width must be a positive integer");

  expect(() => createVerticalProjection({
    width: 2,
    height: 1.5,
    data: new Uint8Array(3)
  })).toThrow("BinaryImage height must be a positive integer");
});

test("Projection validates BinaryImage data length", () => {
  expect(() => createHorizontalProjection({
    width: 2,
    height: 2,
    data: new Uint8Array([0, 1, 0])
  })).toThrow("BinaryImage data length must equal width * height");
});

test("Projection validates binary values", () => {
  expect(() => createVerticalProjection({
    width: 2,
    height: 2,
    data: new Uint8Array([0, 1, 2, 0])
  })).toThrow("BinaryImage data must contain only binary values 0 or 1");
});
