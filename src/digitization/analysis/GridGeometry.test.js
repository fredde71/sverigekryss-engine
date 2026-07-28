import {
  buildGridGeometry,
  createGridGeometry
} from "./GridGeometry";

test("buildGridGeometry returns null without at least two lines on each axis", () => {
  expect(buildGridGeometry({
    horizontalCandidates: [{ position: 0 }],
    verticalCandidates: [{ position: 0 }, { position: 10 }]
  })).toBeNull();

  expect(buildGridGeometry({
    horizontalCandidates: [{ position: 0 }, { position: 10 }],
    verticalCandidates: [{ position: 0 }]
  })).toBeNull();
});

test("buildGridGeometry creates bounds, line arrays and row/column counts from candidates", () => {
  expect(buildGridGeometry({
    horizontalCandidates: [
      { position: 0 },
      { position: 10 },
      { position: 20 }
    ],
    verticalCandidates: [
      { position: 5 },
      { position: 15 },
      { position: 25 },
      { position: 35 }
    ]
  })).toEqual({
    bounds: {
      top: 0,
      left: 5,
      width: 30,
      height: 20
    },
    horizontalLines: [0, 10, 20],
    verticalLines: [5, 15, 25, 35],
    rows: 2,
    cols: 3
  });
});

test("buildGridGeometry preserves current candidate ordering behavior", () => {
  expect(buildGridGeometry({
    horizontalCandidates: [
      { position: 10 },
      { position: 0 }
    ],
    verticalCandidates: [
      { position: 15 },
      { position: 5 }
    ]
  })).toEqual({
    bounds: {
      top: 10,
      left: 15,
      width: -10,
      height: -10
    },
    horizontalLines: [10, 0],
    verticalLines: [15, 5],
    rows: 1,
    cols: 1
  });
});

test("createGridGeometry returns the provided geometry shape", () => {
  const geometry = createGridGeometry({
    bounds: {
      top: 0,
      left: 0,
      width: 10,
      height: 10
    },
    horizontalLines: [0, 10],
    verticalLines: [0, 10],
    rows: 1,
    cols: 1
  });

  expect(geometry).toEqual({
    bounds: {
      top: 0,
      left: 0,
      width: 10,
      height: 10
    },
    horizontalLines: [0, 10],
    verticalLines: [0, 10],
    rows: 1,
    cols: 1
  });
});
