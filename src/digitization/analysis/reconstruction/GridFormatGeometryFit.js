import {
  cloneDeterministicValue,
  deepFreeze
} from "./GridLatticeModelSupport";

const AXES = ["horizontal", "vertical"];

export function fitGridFormatGeometry({
  gridFormatGeometrySelection,
  acceptedIndexedAnchors,
  coordinateSystem
} = {}) {
  const selectionStatus = gridFormatGeometrySelection?.status;
  if (selectionStatus !== "selected") {
    return createUnavailableFit(
      selectionStatus === "ambiguous" ? "ambiguous" : "unavailable",
      gridFormatGeometrySelection,
      coordinateSystem,
      [`grid-format-geometry-${selectionStatus || "unavailable"}`]
    );
  }

  const format = gridFormatGeometrySelection.selectedFormat;
  const axes = Object.fromEntries(AXES.map(axis => [
    axis,
    fitAxis({
      axis,
      normalizedPositions: format.axes[axis].normalizedLinePositions,
      anchors: acceptedIndexedAnchors?.[axis]
    })
  ]));
  const status = axes.horizontal.status === "available"
    && axes.vertical.status === "available"
    ? "available"
    : AXES.some(axis => axes[axis].status === "ambiguous")
      ? "ambiguous"
      : "unavailable";

  return deepFreeze({
    type: "grid-format-geometry-fit",
    version: 1,
    status,
    formatId: format.id,
    coordinateSystem: cloneDeterministicValue(coordinateSystem ?? null),
    axes,
    provenance: {
      source: "accepted-indexed-grid-line-anchors",
      selectionArtifactType: gridFormatGeometrySelection.type,
      selectionVersion: gridFormatGeometrySelection.version
    },
    reasons: status === "available"
      ? []
      : AXES.filter(axis => axes[axis].status !== "available")
        .map(axis => `${axis}-affine-fit-${axes[axis].status}`)
  });
}

function fitAxis({ axis, normalizedPositions, anchors }) {
  if (!Array.isArray(anchors) || anchors.length < 2) {
    return unavailableAxis(axis, "insufficient-indexed-anchor-evidence");
  }
  const samples = anchors.map((anchor, order) => {
    const normalizedPosition = normalizedPositions[anchor.latticeIndex];
    if (!Number.isFinite(normalizedPosition)
      || !Number.isFinite(anchor.observedPosition)) {
      throw new Error(`acceptedIndexedAnchors.${axis}[${order}] is invalid`);
    }
    return {
      latticeIndex: anchor.latticeIndex,
      normalizedPosition,
      observedPosition: anchor.observedPosition,
      evidenceReferences: Array.isArray(anchor.evidenceReferences)
        ? anchor.evidenceReferences.slice()
        : []
    };
  });
  const indexes = new Set(samples.map(sample => sample.latticeIndex));
  if (indexes.size !== samples.length) {
    return unavailableAxis(axis, "ambiguous-duplicate-lattice-index");
  }
  const meanX = mean(samples.map(sample => sample.normalizedPosition));
  const meanY = mean(samples.map(sample => sample.observedPosition));
  const denominator = samples.reduce(
    (sum, sample) => sum + (sample.normalizedPosition - meanX) ** 2,
    0
  );
  if (!(denominator > 0)) {
    return unavailableAxis(axis, "insufficient-normalized-position-span");
  }
  const scale = samples.reduce((sum, sample) => (
    sum
    + (sample.normalizedPosition - meanX)
      * (sample.observedPosition - meanY)
  ), 0) / denominator;
  if (!(scale > 0) || !Number.isFinite(scale)) {
    return unavailableAxis(axis, "non-positive-affine-scale");
  }
  const offset = meanY - scale * meanX;
  const residuals = samples.map(sample => {
    const fittedPosition = offset + scale * sample.normalizedPosition;
    return {
      ...sample,
      fittedPosition,
      residual: sample.observedPosition - fittedPosition,
      absoluteResidual: Math.abs(sample.observedPosition - fittedPosition)
    };
  });
  return {
    axis,
    status: "available",
    offset,
    scale,
    linePositions: normalizedPositions.map(position => offset + scale * position),
    acceptedAnchors: samples,
    residuals,
    maximumAbsoluteResidual: Math.max(
      ...residuals.map(value => value.absoluteResidual)
    ),
    reasons: []
  };
}

function unavailableAxis(axis, reason) {
  return {
    axis,
    status: reason.startsWith("ambiguous-") ? "ambiguous" : "unavailable",
    offset: null,
    scale: null,
    linePositions: [],
    acceptedAnchors: [],
    residuals: [],
    maximumAbsoluteResidual: null,
    reasons: [reason]
  };
}

function createUnavailableFit(status, selection, coordinateSystem, reasons) {
  return deepFreeze({
    type: "grid-format-geometry-fit",
    version: 1,
    status,
    formatId: selection?.selectedFormatId ?? null,
    coordinateSystem: cloneDeterministicValue(coordinateSystem ?? null),
    axes: Object.fromEntries(AXES.map(axis => [
      axis,
      unavailableAxis(axis, "selected-grid-format-geometry-unavailable")
    ])),
    provenance: { source: "accepted-indexed-grid-line-anchors" },
    reasons
  });
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
