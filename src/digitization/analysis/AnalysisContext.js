export function createAnalysisContext(initialState = {}) {
  return freezeAnalysisValue({
    imageData: null,
    binaryImage: null,
    projections: null,
    lineCandidates: null,
    gridGeometry: null,
    gridDetection: null,
    diagnostics: [],
    ...initialState
  });
}

export function withImageData(context, imageData) {
  return withContextValue(context, "imageData", imageData);
}

export function withBinaryImage(context, binaryImage) {
  return withContextValue(context, "binaryImage", binaryImage);
}

export function withProjections(context, projections) {
  return withContextValue(context, "projections", projections);
}

export function withLineCandidates(context, lineCandidates) {
  return withContextValue(context, "lineCandidates", lineCandidates);
}

export function withGridGeometry(context, gridGeometry) {
  return withContextValue(context, "gridGeometry", gridGeometry);
}

export function withGridDetection(context, gridDetection) {
  return withContextValue(context, "gridDetection", gridDetection);
}

export function withDiagnostic(context, diagnostic) {
  return freezeAnalysisValue({
    ...context,
    diagnostics: [
      ...(context.diagnostics || []),
      diagnostic
    ]
  });
}

export function isReadOnlyTypedArray() {
  return false;
}

export function freezeAnalysisValue(value) {
  return deepFreeze(cloneForContext(value));
}

function withContextValue(context, key, value) {
  return freezeAnalysisValue({
    ...context,
    [key]: value
  });
}

function cloneForContext(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (isTypedArray(value)) {
    return cloneTypedArray(value);
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    return cloneArrayForContext(value, seen);
  }

  return cloneObjectForContext(value, seen);
}

function cloneArrayForContext(value, seen) {
  const clone = new Array(value.length);
  seen.set(value, clone);

  value.forEach((item, index) => {
    defineContextProperty(clone, index, item, seen);
  });

  return clone;
}

function cloneObjectForContext(value, seen) {
  const clone = {};
  seen.set(value, clone);

  Object.keys(value).forEach(key => {
    defineContextProperty(clone, key, value[key], seen);
  });

  return clone;
}

function defineContextProperty(target, key, value, seen) {
  if (isTypedArray(value)) {
    defineTypedArraySnapshot(target, key, value);
    return;
  }

  Object.defineProperty(target, key, {
    value: cloneForContext(value, seen),
    enumerable: true,
    configurable: false,
    writable: false
  });
}

function defineTypedArraySnapshot(target, key, value) {
  const snapshot = cloneTypedArray(value);

  Object.defineProperty(target, key, {
    get() {
      return cloneTypedArray(snapshot);
    },
    enumerable: true,
    configurable: false
  });
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }

  if (isTypedArray(value)) {
    return value;
  }

  seen.add(value);

  Object.keys(value).forEach(key => {
    deepFreeze(value[key], seen);
  });

  return Object.freeze(value);
}

function cloneTypedArray(value) {
  return new value.constructor(value);
}

function isTypedArray(value) {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}
