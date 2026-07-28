export function createGridDetection({
  geometry,
  confidence,
  diagnostics = []
}) {
  return deepFreeze({
    geometry: geometry ? cloneValue(geometry) : null,
    confidence,
    diagnostics: Array.isArray(diagnostics) ? cloneValue(diagnostics) : []
  });
}

function cloneValue(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return new value.constructor(value);
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const clone = [];
    seen.set(value, clone);
    value.forEach(item => {
      clone.push(cloneValue(item, seen));
    });
    return clone;
  }

  const clone = {};
  seen.set(value, clone);
  Object.keys(value).forEach(key => {
    clone[key] = cloneValue(value[key], seen);
  });
  return clone;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }

  seen.add(value);

  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return value;
  }

  Object.keys(value).forEach(key => {
    deepFreeze(value[key], seen);
  });

  return Object.freeze(value);
}
