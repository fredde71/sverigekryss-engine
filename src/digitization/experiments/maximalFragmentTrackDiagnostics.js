const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const AXES = Object.freeze(["horizontal", "vertical"]);
const SOURCE_EXPERIMENT_ID = "projection-ridge-fragment-diagnostics";

export const maximalFragmentTrackDiagnosticsExperiment = Object.freeze({
  id: "maximal-fragment-track-diagnostics",
  description: "Link overlapping tangential fragments into maximal adjacent-axis tracks without selecting or classifying grid lines.",
  run(_binaryImage, _context = {}, execution) {
    return createMaximalFragmentTrackDiagnostics({
      ridgeDiagnostics: execution?.getSuccessfulDiagnostics?.(
        SOURCE_EXPERIMENT_ID
      ) ?? null
    });
  }
});

export function createMaximalFragmentTrackDiagnostics({
  ridgeDiagnostics,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  assertDevelopmentEnvironment(readEnvironment());
  if (!isCompatibleRidgeDiagnostics(ridgeDiagnostics)) {
    return freezeValue({
      type: "maximal-fragment-track-diagnostics",
      version: 1,
      status: "unavailable",
      coordinateSpace: null,
      analysisRegionProvenance: null,
      sourceArtifact: {
        experimentId: SOURCE_EXPERIMENT_ID,
        status: "unavailable"
      },
      axes: createUnavailableAxes(),
      diagnostics: [createObservationalDiagnostic()],
      reasons: ["projection-ridge-fragment-diagnostics-unavailable"]
    });
  }

  const axes = Object.fromEntries(AXES.map(axis => [
    axis,
    createAxisTracks(axis, ridgeDiagnostics.axes[axis])
  ]));

  return freezeValue({
    type: "maximal-fragment-track-diagnostics",
    version: 1,
    status: "complete",
    coordinateSpace: ridgeDiagnostics.coordinateSpace,
    analysisRegionProvenance: cloneValue(
      ridgeDiagnostics.analysisRegionProvenance
    ),
    sourceArtifact: {
      experimentId: SOURCE_EXPERIMENT_ID,
      type: ridgeDiagnostics.type,
      version: ridgeDiagnostics.version,
      status: ridgeDiagnostics.status
    },
    trackDefinition: {
      adjacency: "immediately-adjacent-normal-axis-position",
      fragmentConnection: "non-empty-tangential-pixel-overlap",
      maximality: "connected-component"
    },
    axes,
    diagnostics: [createObservationalDiagnostic()],
    reasons: []
  });
}

function createAxisTracks(axis, axisEvidence) {
  const nodes = createNodes(axis, axisEvidence.positions);
  const nodesByPosition = groupNodesByPosition(
    nodes,
    axisEvidence.positionCount
  );
  const edges = createEdges(nodesByPosition);
  const components = createComponents(nodes, edges);
  const componentIndexByFragmentId = new Map();
  components.forEach((component, componentIndex) => {
    component.forEach(node => componentIndexByFragmentId.set(
      node.id,
      componentIndex
    ));
  });
  const edgesByComponent = components.map(() => []);
  edges.forEach(edge => edgesByComponent[
    componentIndexByFragmentId.get(edge.fromFragmentId)
  ].push(edge));
  const tracks = components.map((component, sourceOrder) => (
    createTrack({
      axis,
      sourceOrder,
      component,
      edges: edgesByComponent[sourceOrder],
      tangentialLength: axisEvidence.tangentialLength
    })
  ));

  return {
    status: "available",
    axis,
    normalAxisLength: axisEvidence.positionCount,
    tangentialLength: axisEvidence.tangentialLength,
    sourceFragmentCount: nodes.length,
    connectionCount: edges.length,
    trackCount: tracks.length,
    tracks,
    reasons: []
  };
}

function createNodes(axis, positions) {
  const nodes = [];
  positions.forEach(positionEvidence => {
    positionEvidence.orderedTangentialStrokeSegments.forEach(
      (segment, segmentOrder) => {
        const sourceOrder = nodes.length;
        nodes.push({
          id: `${axis}-fragment-${String(sourceOrder + 1).padStart(7, "0")}`,
          sourceOrder,
          normalPosition: positionEvidence.position,
          segmentOrder,
          tangentialStart: segment.start,
          tangentialEnd: segment.end,
          length: segment.length,
          rawProjectionValue: positionEvidence.rawProjectionValue
        });
      }
    );
  });
  return nodes;
}

function groupNodesByPosition(nodes, positionCount) {
  const groups = Array.from({ length: positionCount }, () => []);
  nodes.forEach(node => groups[node.normalPosition].push(node));
  return groups;
}

function createEdges(nodesByPosition) {
  const edges = [];
  for (let position = 1; position < nodesByPosition.length; position++) {
    const previous = nodesByPosition[position - 1];
    const current = nodesByPosition[position];
    let previousIndex = 0;
    let currentIndex = 0;

    while (previousIndex < previous.length && currentIndex < current.length) {
      const from = previous[previousIndex];
      const to = current[currentIndex];
      const overlapStart = Math.max(from.tangentialStart, to.tangentialStart);
      const overlapEnd = Math.min(from.tangentialEnd, to.tangentialEnd);
      if (overlapStart <= overlapEnd) {
        edges.push({
          id: `fragment-overlap-${String(edges.length + 1).padStart(8, "0")}`,
          sourceOrder: edges.length,
          fromFragmentId: from.id,
          toFragmentId: to.id,
          fromNormalPosition: from.normalPosition,
          toNormalPosition: to.normalPosition,
          overlapStart,
          overlapEnd,
          overlapLength: overlapEnd - overlapStart + 1
        });
      }
      if (from.tangentialEnd <= to.tangentialEnd) {
        previousIndex += 1;
      } else {
        currentIndex += 1;
      }
    }
  }
  return edges;
}

function createComponents(nodes, edges) {
  const parent = nodes.map((_node, index) => index);
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));

  edges.forEach(edge => union(
    parent,
    indexById.get(edge.fromFragmentId),
    indexById.get(edge.toFragmentId)
  ));

  const groups = new Map();
  nodes.forEach((node, index) => {
    const root = find(parent, index);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root).push(node);
  });

  return Array.from(groups.values()).sort((left, right) => (
    left[0].sourceOrder - right[0].sourceOrder
  ));
}

function find(parent, index) {
  let root = index;
  while (parent[root] !== root) {
    root = parent[root];
  }
  while (parent[index] !== index) {
    const next = parent[index];
    parent[index] = root;
    index = next;
  }
  return root;
}

function union(parent, left, right) {
  const leftRoot = find(parent, left);
  const rightRoot = find(parent, right);
  if (leftRoot === rightRoot) {
    return;
  }
  const first = Math.min(leftRoot, rightRoot);
  const second = Math.max(leftRoot, rightRoot);
  parent[second] = first;
}

function createTrack({
  axis,
  sourceOrder,
  component,
  edges,
  tangentialLength
}) {
  const trackEdges = edges;
  const incomingById = groupEdges(trackEdges, "toFragmentId");
  const outgoingById = groupEdges(trackEdges, "fromFragmentId");
  const normalAxisStart = component[0].normalPosition;
  const normalAxisEnd = component[component.length - 1].normalPosition;
  let tangentialStart = component[0].tangentialStart;
  let tangentialEnd = component[0].tangentialEnd;
  component.forEach(node => {
    tangentialStart = Math.min(tangentialStart, node.tangentialStart);
    tangentialEnd = Math.max(tangentialEnd, node.tangentialEnd);
  });
  const positions = groupComponentByPosition(component);

  return {
    type: "maximal-fragment-track-observation",
    version: 1,
    id: `${axis}-fragment-track-${String(sourceOrder + 1).padStart(6, "0")}`,
    sourceOrder,
    axis,
    normalAxisSpan: {
      start: normalAxisStart,
      end: normalAxisEnd,
      thickness: normalAxisEnd - normalAxisStart + 1
    },
    tangentialExtent: {
      start: tangentialStart,
      end: tangentialEnd,
      length: tangentialEnd - tangentialStart + 1,
      axisLength: tangentialLength
    },
    fragmentCount: component.length,
    orderedFragmentEvolution: component.map(node => ({
      ...node,
      incomingOverlapReferences: (incomingById.get(node.id) ?? []).map(
        edge => edge.id
      ),
      outgoingOverlapReferences: (outgoingById.get(node.id) ?? []).map(
        edge => edge.id
      )
    })),
    overlapEvolution: trackEdges.map(edge => ({ ...edge })),
    continuity: createContinuity({
      positions,
      edges: trackEdges,
      normalAxisStart,
      normalAxisEnd
    }),
    topology: createTopology(component, incomingById, outgoingById),
    projectionProfile: positions.map(entry => ({
      normalPosition: entry.normalPosition,
      sourceRawProjectionValue: entry.nodes[0].rawProjectionValue,
      trackFragmentCount: entry.nodes.length,
      trackStrokeLength: entry.nodes.reduce(
        (total, node) => total + node.length,
        0
      )
    })),
    provenanceReferences: {
      sourceExperimentId: SOURCE_EXPERIMENT_ID,
      sourceFragmentIds: component.map(node => node.id)
    },
    reasons: []
  };
}

function groupEdges(edges, key) {
  const groups = new Map();
  edges.forEach(edge => {
    if (!groups.has(edge[key])) {
      groups.set(edge[key], []);
    }
    groups.get(edge[key]).push(edge);
  });
  return groups;
}

function groupComponentByPosition(component) {
  const groups = [];
  component.forEach(node => {
    const current = groups[groups.length - 1];
    if (current?.normalPosition === node.normalPosition) {
      current.nodes.push(node);
    } else {
      groups.push({ normalPosition: node.normalPosition, nodes: [node] });
    }
  });
  return groups;
}

function createContinuity({
  positions,
  edges,
  normalAxisStart,
  normalAxisEnd
}) {
  const connectedTransitions = new Set(edges.map(
    edge => `${edge.fromNormalPosition}:${edge.toNormalPosition}`
  ));
  const overlapLengths = edges.map(edge => edge.overlapLength);
  return {
    observedNormalPositionCount: positions.length,
    normalAxisSpanPositionCount: normalAxisEnd - normalAxisStart + 1,
    adjacentTransitionCount: connectedTransitions.size,
    possibleAdjacentTransitionCount: Math.max(
      0,
      normalAxisEnd - normalAxisStart
    ),
    overlapConnectionCount: edges.length,
    totalOverlapLength: overlapLengths.reduce(
      (total, length) => total + length,
      0
    ),
    minimumOverlapLength: overlapLengths.length > 0
      ? Math.min(...overlapLengths)
      : null,
    maximumOverlapLength: overlapLengths.length > 0
      ? Math.max(...overlapLengths)
      : null
  };
}

function createTopology(component, incomingById, outgoingById) {
  const splitPoints = component.filter(
    node => (outgoingById.get(node.id)?.length ?? 0) > 1
  ).map(node => ({
    fragmentId: node.id,
    normalPosition: node.normalPosition,
    outgoingCount: outgoingById.get(node.id).length
  }));
  const mergePoints = component.filter(
    node => (incomingById.get(node.id)?.length ?? 0) > 1
  ).map(node => ({
    fragmentId: node.id,
    normalPosition: node.normalPosition,
    incomingCount: incomingById.get(node.id).length
  }));
  const fragmentsPerPosition = new Map();
  component.forEach(node => fragmentsPerPosition.set(
    node.normalPosition,
    (fragmentsPerPosition.get(node.normalPosition) ?? 0) + 1
  ));

  return {
    splitCount: splitPoints.length,
    mergeCount: mergePoints.length,
    splitPoints,
    mergePoints,
    maximumFragmentsAtOneNormalPosition: Math.max(
      ...fragmentsPerPosition.values()
    )
  };
}

function createUnavailableAxes() {
  return Object.fromEntries(AXES.map(axis => [axis, {
    status: "unavailable",
    axis,
    normalAxisLength: null,
    tangentialLength: null,
    sourceFragmentCount: 0,
    connectionCount: 0,
    trackCount: 0,
    tracks: [],
    reasons: ["projection-ridge-fragment-diagnostics-unavailable"]
  }]));
}

function createObservationalDiagnostic() {
  return {
    code: "maximal-fragment-tracks-are-observational",
    centerSelected: false,
    candidateCreated: false,
    classificationApplied: false,
    admissionChanged: false,
    groundTruthAccessed: false
  };
}

function isCompatibleRidgeDiagnostics(value) {
  return Boolean(
    value?.type === "projection-ridge-fragment-diagnostics"
    && value.version === 1
    && AXES.every(axis => Array.isArray(value.axes?.[axis]?.positions))
  );
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Maximal fragment track diagnostics are available only in development or test"
    );
  }
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(
      ([key, entry]) => [key, cloneValue(entry)]
    ));
  }
  return value;
}

function freezeValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
