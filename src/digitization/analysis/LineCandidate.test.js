import {
  createLineCandidate,
  findLineCandidates
} from "./LineCandidate";

test("findLineCandidates returns contiguous runs above the coverage threshold", () => {
  const candidates = findLineCandidates(new Uint32Array([0, 4, 4, 0, 5]), {
    axis: "horizontal",
    axisLength: 5,
    minCoverageRatio: 0.8
  });

  expect(candidates).toEqual([
    {
      axis: "horizontal",
      start: 1,
      end: 2,
      position: 1.5,
      thickness: 2,
      strength: 4,
      averageStrength: 4
    },
    {
      axis: "horizontal",
      start: 4,
      end: 4,
      position: 4,
      thickness: 1,
      strength: 5,
      averageStrength: 5
    }
  ]);
});

test("findLineCandidates keeps the existing default coverage behavior", () => {
  expect(findLineCandidates(new Uint32Array([3, 4]), {
    axisLength: 5
  })).toEqual([
    createLineCandidate({
      axis: undefined,
      start: 1,
      end: 1,
      position: 1,
      thickness: 1,
      strength: 4,
      averageStrength: 4
    })
  ]);
});

test("findLineCandidates validates projection input", () => {
  expect(() => findLineCandidates(null, {
    axisLength: 5
  })).toThrow("Projection is required");

  expect(() => findLineCandidates([0, -1], {
    axisLength: 5
  })).toThrow("Projection values must be finite non-negative numbers");
});

test("findLineCandidates validates axisLength", () => {
  expect(() => findLineCandidates(new Uint32Array([1]), {}))
    .toThrow("axisLength must be a positive integer");

  expect(() => findLineCandidates(new Uint32Array([1]), {
    axisLength: 1.5
  })).toThrow("axisLength must be a positive integer");
});

test("findLineCandidates validates minCoverageRatio", () => {
  expect(() => findLineCandidates(new Uint32Array([1]), {
    axisLength: 1,
    minCoverageRatio: 1.5
  })).toThrow("minCoverageRatio must be a number between 0 and 1");
});
