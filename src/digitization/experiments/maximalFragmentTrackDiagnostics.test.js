import {
  createMaximalFragmentTrackDiagnostics,
  maximalFragmentTrackDiagnosticsExperiment
} from "./maximalFragmentTrackDiagnostics";
import {
  createProjectionRidgeFragmentDiagnostics
} from "./projectionRidgeFragmentDiagnostics";

test("links overlapping fragments into deterministic maximal tracks", () => {
  const ridgeDiagnostics = createRidgeDiagnostics();
  const result = createMaximalFragmentTrackDiagnostics({
    ridgeDiagnostics,
    readEnvironment: () => "test"
  });
  const horizontal = result.axes.horizontal;
  const main = horizontal.tracks.find(track => (
    track.normalAxisSpan.start === 0
    && track.normalAxisSpan.end === 2
    && track.tangentialExtent.start === 0
  ));

  expect(result).toMatchObject({
    type: "maximal-fragment-track-diagnostics",
    version: 1,
    status: "complete",
    trackDefinition: {
      fragmentConnection: "non-empty-tangential-pixel-overlap",
      maximality: "connected-component"
    }
  });
  expect(main).toMatchObject({
    normalAxisSpan: { start: 0, end: 2, thickness: 3 },
    tangentialExtent: { start: 0, end: 4, length: 5 },
    continuity: {
      observedNormalPositionCount: 3,
      adjacentTransitionCount: 2,
      possibleAdjacentTransitionCount: 2
    },
    projectionProfile: [
      { normalPosition: 0, trackStrokeLength: 5 },
      { normalPosition: 1, trackStrokeLength: 4 },
      { normalPosition: 2, trackStrokeLength: 3 }
    ]
  });
  expect(horizontal.tracks.map(track => track.sourceOrder)).toEqual(
    horizontal.tracks.map((_track, index) => index)
  );
});

test("preserves splitting and merging topology factually", () => {
  const result = createMaximalFragmentTrackDiagnostics({
    ridgeDiagnostics: createRidgeDiagnostics(),
    readEnvironment: () => "test"
  });
  const track = result.axes.horizontal.tracks.find(value => (
    value.normalAxisSpan.thickness === 3
    && value.tangentialExtent.start === 0
  ));

  expect(track.topology).toMatchObject({
    splitCount: 1,
    mergeCount: 1,
    maximumFragmentsAtOneNormalPosition: 2
  });
  expect(track.overlapEvolution.map(value => value.overlapLength))
    .toEqual([2, 2, 1, 1]);
  expect(track.orderedFragmentEvolution.map(value => ({
    position: value.normalPosition,
    start: value.tangentialStart,
    incoming: value.incomingOverlapReferences.length,
    outgoing: value.outgoingOverlapReferences.length
  }))).toEqual([
    { position: 0, start: 0, incoming: 0, outgoing: 2 },
    { position: 1, start: 0, incoming: 1, outgoing: 1 },
    { position: 1, start: 3, incoming: 1, outgoing: 1 },
    { position: 2, start: 1, incoming: 2, outgoing: 0 }
  ]);
});

test("keeps unavailable source evidence explicit", () => {
  const result = createMaximalFragmentTrackDiagnostics({
    ridgeDiagnostics: null,
    readEnvironment: () => "test"
  });

  expect(result).toMatchObject({
    status: "unavailable",
    reasons: ["projection-ridge-fragment-diagnostics-unavailable"],
    axes: {
      horizontal: { status: "unavailable", tracks: [] },
      vertical: { status: "unavailable", tracks: [] }
    }
  });
});

test("wrapper consumes the preceding Lab artifact by exact reference", () => {
  const ridgeDiagnostics = createRidgeDiagnostics();
  const getSuccessfulDiagnostics = jest.fn(() => ridgeDiagnostics);
  const result = maximalFragmentTrackDiagnosticsExperiment.run(
    new Proxy({}, { get() { throw new Error("BinaryImage must not be read"); } }),
    new Proxy({}, { get() { throw new Error("context must not be read"); } }),
    { getSuccessfulDiagnostics }
  );

  expect(getSuccessfulDiagnostics).toHaveBeenCalledWith(
    "projection-ridge-fragment-diagnostics"
  );
  expect(result.status).toBe("complete");
});

test("is deterministic, deeply immutable, and observation-only", () => {
  const ridgeDiagnostics = createRidgeDiagnostics();
  const before = JSON.stringify(ridgeDiagnostics);
  const first = createMaximalFragmentTrackDiagnostics({
    ridgeDiagnostics,
    readEnvironment: () => "development"
  });
  const second = createMaximalFragmentTrackDiagnostics({
    ridgeDiagnostics,
    readEnvironment: () => "development"
  });

  expect(second).toEqual(first);
  expect(JSON.stringify(ridgeDiagnostics)).toBe(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axes.horizontal.tracks)).toBe(true);
  expect(Object.isFrozen(
    first.axes.horizontal.tracks[0].orderedFragmentEvolution
  )).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|classification|admissionDecision|recommendation|selection)"\s*:/
  );
});

test("is development and test only", () => {
  expect(() => createMaximalFragmentTrackDiagnostics({
    ridgeDiagnostics: createRidgeDiagnostics(),
    readEnvironment: () => "production"
  })).toThrow(
    "Maximal fragment track diagnostics are available only in development or test"
  );
});

function createRidgeDiagnostics() {
  return createProjectionRidgeFragmentDiagnostics({
    binaryImage: {
      width: 6,
      height: 3,
      data: new Uint8Array([
        1, 1, 1, 1, 1, 0,
        1, 1, 0, 1, 1, 0,
        0, 1, 1, 1, 0, 0
      ])
    },
    readEnvironment: () => "test"
  });
}
