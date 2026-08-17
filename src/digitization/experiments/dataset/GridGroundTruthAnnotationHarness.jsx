import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { preparePdfDatasetInput } from "./pdfDatasetAdapter";
import {
  createGridGroundTruth,
  downloadGridGroundTruth
} from "./gridGroundTruth";

const HALF_PIXEL = 0.5;

export default function GridGroundTruthAnnotationHarness({
  datasetId,
  items = [],
  validationReport = null,
  prepareInput = preparePdfDatasetInput,
  createGroundTruth = createGridGroundTruth,
  downloadGroundTruth = downloadGridGroundTruth,
  onGroundTruthChange = () => {},
  readEnvironment = () => process.env.NODE_ENV,
  readHostname = () => (
    typeof window === "undefined" ? "" : window.location.hostname
  )
}) {
  const environment = readEnvironment();
  const hostname = readHostname();
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? "");
  const [rendered, setRendered] = useState(null);
  const [renderStatus, setRenderStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTool, setActiveTool] = useState(null);
  const [boundaries, setBoundaries] = useState(createEmptyBoundaries);
  const [rows, setRows] = useState("");
  const [cols, setCols] = useState("");
  const [horizontalLines, setHorizontalLines] = useState([]);
  const [verticalLines, setVerticalLines] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [confirmedAnnotations, setConfirmedAnnotations] = useState({});
  const [groundTruth, setGroundTruth] = useState(null);
  const [showShadowOverlay, setShowShadowOverlay] = useState(false);
  const canvasHostRef = useRef(null);
  const surfaceRef = useRef(null);
  const selectedItem = items.find(item => item.id === selectedItemId) ?? null;
  const currentAnnotation = confirmedAnnotations[selectedItemId] ?? null;

  useEffect(() => {
    if (items.length === 0) {
      setSelectedItemId("");
      return;
    }

    if (!items.some(item => item.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    const host = canvasHostRef.current;
    const source = rendered?.source;

    if (!host) {
      return;
    }

    while (host.firstChild) {
      host.removeChild(host.firstChild);
    }

    if (source && typeof source.nodeType === "number") {
      source.style.width = "100%";
      source.style.height = "100%";
      source.style.display = "block";
      host.appendChild(source);
    }
  }, [rendered]);

  if (
    environment !== "test"
    && (
      environment !== "development"
      || !isLocalHostname(hostname)
    )
  ) {
    return null;
  }

  const handleItemSelection = event => {
    const itemId = event.target.value;
    const annotation = confirmedAnnotations[itemId];

    setSelectedItemId(itemId);
    setRendered(null);
    setRenderStatus("idle");
    setErrorMessage("");
    setActiveTool(null);
    setShowShadowOverlay(false);

    if (annotation) {
      setBoundaries({
        top: annotation.gridBounds.top,
        bottom: annotation.gridBounds.top + annotation.gridBounds.height,
        left: annotation.gridBounds.left,
        right: annotation.gridBounds.left + annotation.gridBounds.width
      });
      setRows(String(annotation.rows));
      setCols(String(annotation.cols));
      setHorizontalLines(annotation.horizontalLinePositions.slice());
      setVerticalLines(annotation.verticalLinePositions.slice());
    } else {
      resetDraft();
    }
  };

  const handleRender = async () => {
    if (!selectedItem) {
      return;
    }

    setRenderStatus("rendering");
    setErrorMessage("");
    setShowShadowOverlay(false);

    try {
      const prepared = await prepareInput(selectedItem);
      const source = prepared?.source;

      if (
        !source
        || !Number.isFinite(source.width)
        || source.width <= 0
        || !Number.isFinite(source.height)
        || source.height <= 0
      ) {
        throw new Error("Rendered PDF canvas dimensions are required");
      }

      setRendered({
        source,
        width: source.width,
        height: source.height
      });
      setRenderStatus("rendered");
    } catch (error) {
      setRendered(null);
      setRenderStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleGroundTruthLoad = async event => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      if (typeof file.text !== "function") {
        throw new Error("Ground truth file text reader is required");
      }

      const parsed = JSON.parse(await file.text());
      const artifact = createGroundTruth(parsed);

      if (artifact.datasetId !== datasetId) {
        throw new Error("Loaded ground truth datasetId must match exactly");
      }

      const itemsById = new Map(items.map(item => [item.id, item]));

      for (const annotation of artifact.annotations) {
        const item = itemsById.get(annotation.itemId);

        if (!item) {
          throw new Error(`Loaded ground truth item is unavailable: ${annotation.itemId}`);
        }

        if (item.metadata?.filename !== annotation.filename) {
          throw new Error(`Loaded ground truth filename mismatch: ${annotation.itemId}`);
        }
      }

      const next = Object.fromEntries(
        artifact.annotations.map(annotation => [annotation.itemId, annotation])
      );
      const selectedAnnotation = next[selectedItemId];

      setConfirmedAnnotations(next);
      setGroundTruth(artifact);
      onGroundTruthChange(artifact);
      setErrorMessage("");

      if (selectedAnnotation) {
        applyAnnotationToDraft(selectedAnnotation);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      event.target.value = "";
    }
  };

  const invalidateCurrentConfirmation = () => {
    if (!confirmedAnnotations[selectedItemId]) {
      return;
    }

    const next = { ...confirmedAnnotations };
    delete next[selectedItemId];
    commitConfirmedAnnotations(next);
    setShowShadowOverlay(false);
  };

  const handleSurfaceClick = event => {
    if (!rendered || !activeTool) {
      return;
    }

    const point = getSurfacePoint(event, surfaceRef.current, zoom, rendered);

    if (["top", "bottom", "left", "right"].includes(activeTool)) {
      setBoundaries(previous => ({
        ...previous,
        [activeTool]: ["top", "bottom"].includes(activeTool) ? point.y : point.x
      }));
      setHorizontalLines([]);
      setVerticalLines([]);
      invalidateCurrentConfirmation();
    }

    if (activeTool === "add-horizontal") {
      const next = insertPosition(horizontalLines, point.y);
      setHorizontalLines(next);
      setRows(String(Math.max(1, next.length - 1)));
      if (next.length > 0) {
        setBoundaries(previous => ({
          ...previous,
          top: next[0],
          bottom: next[next.length - 1]
        }));
      }
      invalidateCurrentConfirmation();
    }

    if (activeTool === "add-vertical") {
      const next = insertPosition(verticalLines, point.x);
      setVerticalLines(next);
      setCols(String(Math.max(1, next.length - 1)));
      if (next.length > 0) {
        setBoundaries(previous => ({
          ...previous,
          left: next[0],
          right: next[next.length - 1]
        }));
      }
      invalidateCurrentConfirmation();
    }

    setActiveTool(null);
  };

  const handleGenerateDraft = () => {
    const rowCount = Number(rows);
    const colCount = Number(cols);

    if (!hasCompleteBoundaries(boundaries)) {
      setErrorMessage("Place all four grid boundaries before generating draft lines");
      return;
    }

    if (!Number.isInteger(rowCount) || rowCount < 1) {
      setErrorMessage("Rows must be a positive integer");
      return;
    }

    if (!Number.isInteger(colCount) || colCount < 1) {
      setErrorMessage("Columns must be a positive integer");
      return;
    }

    try {
      setHorizontalLines(createDraftLines(boundaries.top, boundaries.bottom, rowCount));
      setVerticalLines(createDraftLines(boundaries.left, boundaries.right, colCount));
      setErrorMessage("");
      invalidateCurrentConfirmation();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const moveLine = (axis, index, requestedPosition) => {
    const lines = axis === "horizontal" ? horizontalLines : verticalLines;
    const maximum = axis === "horizontal" ? rendered.height : rendered.width;
    const position = clampLinePosition(
      roundHalfPixel(requestedPosition),
      lines,
      index,
      maximum
    );
    const next = lines.map((line, lineIndex) => (
      lineIndex === index ? position : line
    ));

    if (axis === "horizontal") {
      setHorizontalLines(next);
      setBoundaries(previous => ({
        ...previous,
        top: next[0],
        bottom: next[next.length - 1]
      }));
    } else {
      setVerticalLines(next);
      setBoundaries(previous => ({
        ...previous,
        left: next[0],
        right: next[next.length - 1]
      }));
    }

    invalidateCurrentConfirmation();
  };

  const handleSurfaceMouseMove = event => {
    if (!dragging || !rendered) {
      return;
    }

    const point = getSurfacePoint(event, surfaceRef.current, zoom, rendered);

    if (dragging.boundary) {
      moveBoundary(
        dragging.boundary,
        ["top", "bottom"].includes(dragging.boundary) ? point.y : point.x
      );
      return;
    }

    moveLine(
      dragging.axis,
      dragging.index,
      dragging.axis === "horizontal" ? point.y : point.x
    );
  };

  const moveBoundary = (name, requestedPosition) => {
    const verticalAxis = ["top", "bottom"].includes(name);
    const maximum = verticalAxis ? rendered.height : rendered.width;
    const lowerName = name === "top" ? null : name === "bottom" ? "top" : name === "right" ? "left" : null;
    const upperName = name === "top" ? "bottom" : name === "left" ? "right" : null;
    const minimum = lowerName && Number.isFinite(boundaries[lowerName])
      ? boundaries[lowerName] + HALF_PIXEL
      : 0;
    const upper = upperName && Number.isFinite(boundaries[upperName])
      ? boundaries[upperName] - HALF_PIXEL
      : maximum;

    setBoundaries(previous => ({
      ...previous,
      [name]: clamp(roundHalfPixel(requestedPosition), minimum, upper)
    }));
    invalidateCurrentConfirmation();
  };

  const handleBoundaryKeyDown = (event, name) => {
    const negative = ["top", "bottom"].includes(name) ? "ArrowUp" : "ArrowLeft";
    const positive = ["top", "bottom"].includes(name) ? "ArrowDown" : "ArrowRight";

    if (event.key !== negative && event.key !== positive) {
      return;
    }

    event.preventDefault();
    moveBoundary(
      name,
      boundaries[name] + (event.key === negative ? -HALF_PIXEL : HALF_PIXEL)
    );
  };

  const handleLineKeyDown = (event, axis, index) => {
    const negative = axis === "horizontal" ? "ArrowUp" : "ArrowLeft";
    const positive = axis === "horizontal" ? "ArrowDown" : "ArrowRight";

    if (event.key !== negative && event.key !== positive) {
      return;
    }

    event.preventDefault();
    const lines = axis === "horizontal" ? horizontalLines : verticalLines;
    const delta = event.key === negative ? -HALF_PIXEL : HALF_PIXEL;

    moveLine(axis, index, lines[index] + delta);
  };

  const removeLine = (axis, index) => {
    const lines = axis === "horizontal" ? horizontalLines : verticalLines;

    if (lines.length <= 2) {
      setErrorMessage("A grid requires at least two lines on each axis");
      return;
    }

    const next = lines.filter((_, lineIndex) => lineIndex !== index);

    if (axis === "horizontal") {
      setHorizontalLines(next);
      setRows(String(next.length - 1));
      setBoundaries(previous => ({
        ...previous,
        top: next[0],
        bottom: next[next.length - 1]
      }));
    } else {
      setVerticalLines(next);
      setCols(String(next.length - 1));
      setBoundaries(previous => ({
        ...previous,
        left: next[0],
        right: next[next.length - 1]
      }));
    }

    invalidateCurrentConfirmation();
  };

  const handleConfirm = () => {
    if (!selectedItem || !rendered) {
      return;
    }

    try {
      const annotation = {
        itemId: selectedItem.id,
        filename: selectedItem.metadata?.filename,
        document: {
          width: rendered.width,
          height: rendered.height
        },
        gridBounds: {
          top: horizontalLines[0],
          left: verticalLines[0],
          width: verticalLines[verticalLines.length - 1] - verticalLines[0],
          height: horizontalLines[horizontalLines.length - 1] - horizontalLines[0]
        },
        horizontalLinePositions: horizontalLines.slice(),
        verticalLinePositions: verticalLines.slice(),
        rows: horizontalLines.length - 1,
        cols: verticalLines.length - 1,
        annotation: {
          status: "human-confirmed",
          method: "visual-line-handles",
          interpolationUsedForDraft: true
        }
      };

      createGroundTruth({ datasetId, annotations: [annotation] });
      commitConfirmedAnnotations({
        ...confirmedAnnotations,
        [selectedItem.id]: annotation
      });
      setRows(String(annotation.rows));
      setCols(String(annotation.cols));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const shadowComparison = useMemo(() => (
    findShadowComparison(validationReport, selectedItemId)
  ), [selectedItemId, validationReport]);
  const shadowObservation = shadowComparison?.normalizedObservation ?? null;
  const canConfirm = Boolean(
    rendered
    && horizontalLines.length >= 2
    && verticalLines.length >= 2
    && Number(rows) === horizontalLines.length - 1
    && Number(cols) === verticalLines.length - 1
  );

  return (
    <section aria-label="Grid ground truth annotation">
      <h6>Grid ground truth annotation</h6>
      <p>
        Development-only manual annotation. Draft guides are not ground truth
        until explicitly confirmed.
      </p>
      <label>
        Load ground truth JSON
        <input
          aria-label="Load ground truth JSON"
          type="file"
          accept="application/json,.json"
          onChange={handleGroundTruthLoad}
        />
      </label>
      <label>
        Dataset item
        <select
          aria-label="Dataset item"
          value={selectedItemId}
          onChange={handleItemSelection}
        >
          {items.map(item => (
            <option key={item.id} value={item.id}>
              {item.id}: {item.metadata?.filename}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!selectedItem || renderStatus === "rendering"}
        onClick={handleRender}
      >
        {renderStatus === "rendering" ? "Rendering PDF…" : "Render selected PDF"}
      </button>
      {renderStatus === "rendered" && rendered && (
        <>
          <div>
            {[
              ["top", "Place top boundary"],
              ["bottom", "Place bottom boundary"],
              ["left", "Place left boundary"],
              ["right", "Place right boundary"]
            ].map(([tool, label]) => (
              <button
                key={tool}
                type="button"
                aria-pressed={activeTool === tool}
                onClick={() => setActiveTool(tool)}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            Rows
            <input
              aria-label="Rows"
              type="number"
              min="1"
              step="1"
              value={rows}
              onChange={event => {
                setRows(event.target.value);
                invalidateCurrentConfirmation();
              }}
            />
          </label>
          <label>
            Columns
            <input
              aria-label="Columns"
              type="number"
              min="1"
              step="1"
              value={cols}
              onChange={event => {
                setCols(event.target.value);
                invalidateCurrentConfirmation();
              }}
            />
          </label>
          <button type="button" onClick={handleGenerateDraft}>
            Generate draft line handles
          </button>
          <button
            type="button"
            aria-pressed={activeTool === "add-horizontal"}
            onClick={() => setActiveTool("add-horizontal")}
          >
            Add horizontal line
          </button>
          <button
            type="button"
            aria-pressed={activeTool === "add-vertical"}
            onClick={() => setActiveTool("add-vertical")}
          >
            Add vertical line
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom(value => Math.max(0.25, value - 0.25))}
          >
            Zoom out
          </button>
          <output aria-label="Annotation zoom">{Math.round(zoom * 100)}%</output>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom(value => Math.min(3, value + 0.25))}
          >
            Zoom in
          </button>
          <div style={{ maxHeight: "600px", overflow: "auto" }}>
            <div
              ref={surfaceRef}
              data-testid="ground-truth-surface"
              onClick={handleSurfaceClick}
              onMouseMove={handleSurfaceMouseMove}
              onMouseUp={() => setDragging(null)}
              onMouseLeave={() => setDragging(null)}
              style={{
                position: "relative",
                width: `${rendered.width * zoom}px`,
                height: `${rendered.height * zoom}px`
              }}
            >
              <div
                ref={canvasHostRef}
                aria-label="Rendered PDF page 1 at scale 2"
                style={{ position: "absolute", inset: 0 }}
              />
              {horizontalLines.length === 0 && ["top", "bottom"].map(name => (
                Number.isFinite(boundaries[name]) && (
                  <BoundaryHandle
                    key={name}
                    name={name}
                    position={boundaries[name]}
                    zoom={zoom}
                    onMouseDown={() => setDragging({ boundary: name })}
                    onKeyDown={handleBoundaryKeyDown}
                  />
                )
              ))}
              {verticalLines.length === 0 && ["left", "right"].map(name => (
                Number.isFinite(boundaries[name]) && (
                  <BoundaryHandle
                    key={name}
                    name={name}
                    position={boundaries[name]}
                    zoom={zoom}
                    onMouseDown={() => setDragging({ boundary: name })}
                    onKeyDown={handleBoundaryKeyDown}
                  />
                )
              ))}
              {horizontalLines.map((position, index) => (
                <LineHandle
                  key={`horizontal-${index}`}
                  axis="horizontal"
                  index={index}
                  position={position}
                  zoom={zoom}
                  onMouseDown={() => setDragging({ axis: "horizontal", index })}
                  onKeyDown={handleLineKeyDown}
                  onRemove={removeLine}
                />
              ))}
              {verticalLines.map((position, index) => (
                <LineHandle
                  key={`vertical-${index}`}
                  axis="vertical"
                  index={index}
                  position={position}
                  zoom={zoom}
                  onMouseDown={() => setDragging({ axis: "vertical", index })}
                  onKeyDown={handleLineKeyDown}
                  onRemove={removeLine}
                />
              ))}
              {showShadowOverlay && shadowObservation && (
                <ShadowOverlay observation={shadowObservation} zoom={zoom} />
              )}
            </div>
          </div>
          <button type="button" disabled={!canConfirm} onClick={handleConfirm}>
            Confirm ground truth for selected item
          </button>
          {currentAnnotation && (
            <span role="status">Ground truth confirmed for {selectedItemId}</span>
          )}
          {currentAnnotation && validationReport && (
            <label>
              <input
                aria-label="Show experimental shadow overlay"
                type="checkbox"
                checked={showShadowOverlay}
                onChange={event => setShowShadowOverlay(event.target.checked)}
              />
              Show experimental shadow overlay and comparison
            </label>
          )}
          {showShadowOverlay && shadowComparison && (
            <output aria-label="Shadow grid comparison">
              Region {shadowComparison.regionId}: bounds {formatComparisonState(
                shadowComparison.bounds
              )}, horizontal lines {formatComparisonState(
                shadowComparison.horizontalLines
              )}, vertical lines {formatComparisonState(
                shadowComparison.verticalLines
              )}, rows {formatComparisonState(shadowComparison.rows)}, columns {formatComparisonState(
                shadowComparison.cols
              )}.
            </output>
          )}
        </>
      )}
      {groundTruth && (
        <button type="button" onClick={() => downloadGroundTruth(groundTruth)}>
          Download ground truth JSON
        </button>
      )}
      {errorMessage && <span role="alert">Annotation unavailable: {errorMessage}</span>}
    </section>
  );

  function resetDraft() {
    setBoundaries(createEmptyBoundaries());
    setRows("");
    setCols("");
    setHorizontalLines([]);
    setVerticalLines([]);
  }

  function applyAnnotationToDraft(annotation) {
    setBoundaries({
      top: annotation.gridBounds.top,
      bottom: annotation.gridBounds.top + annotation.gridBounds.height,
      left: annotation.gridBounds.left,
      right: annotation.gridBounds.left + annotation.gridBounds.width
    });
    setRows(String(annotation.rows));
    setCols(String(annotation.cols));
    setHorizontalLines(annotation.horizontalLinePositions.slice());
    setVerticalLines(annotation.verticalLinePositions.slice());
  }

  function commitConfirmedAnnotations(next) {
    const orderedAnnotations = items.flatMap(item => (
      next[item.id] ? [next[item.id]] : []
    ));
    const artifact = orderedAnnotations.length > 0
      ? createGroundTruth({ datasetId, annotations: orderedAnnotations })
      : null;

    setConfirmedAnnotations(next);
    setGroundTruth(artifact);
    onGroundTruthChange(artifact);
  }
}

function BoundaryHandle({
  name,
  position,
  zoom,
  onMouseDown,
  onKeyDown
}) {
  const horizontal = ["top", "bottom"].includes(name);

  return (
    <div
      role="slider"
      aria-label={`${capitalize(name)} boundary handle`}
      aria-valuenow={position}
      tabIndex="0"
      onMouseDown={event => {
        event.stopPropagation();
        onMouseDown();
      }}
      onKeyDown={event => onKeyDown(event, name)}
      style={{
        position: "absolute",
        zIndex: 2,
        background: "rgba(51, 65, 85, 0.8)",
        cursor: horizontal ? "row-resize" : "col-resize",
        ...(horizontal
          ? { left: 0, right: 0, top: `${position * zoom}px`, height: "2px" }
          : { top: 0, bottom: 0, left: `${position * zoom}px`, width: "2px" })
      }}
    />
  );
}

function LineHandle({
  axis,
  index,
  position,
  zoom,
  onMouseDown,
  onKeyDown,
  onRemove
}) {
  const label = `${capitalize(axis)} line ${index + 1}`;
  const horizontal = axis === "horizontal";

  return (
    <>
      <div
        role="slider"
        aria-label={label}
        aria-valuenow={position}
        tabIndex="0"
        onMouseDown={event => {
          event.stopPropagation();
          onMouseDown();
        }}
        onKeyDown={event => onKeyDown(event, axis, index)}
        style={{
          position: "absolute",
          zIndex: 2,
          background: horizontal ? "rgba(70, 90, 120, 0.75)" : "rgba(110, 120, 135, 0.75)",
          cursor: horizontal ? "row-resize" : "col-resize",
          ...(horizontal
            ? { left: 0, right: 0, top: `${position * zoom}px`, height: "2px" }
            : { top: 0, bottom: 0, left: `${position * zoom}px`, width: "2px" })
        }}
      />
      <button
        type="button"
        aria-label={`Remove ${axis} line ${index + 1}`}
        onClick={() => onRemove(axis, index)}
        style={{
          position: "absolute",
          zIndex: 4,
          fontSize: "10px",
          ...(horizontal
            ? { right: 0, top: `${position * zoom}px` }
            : { top: 0, left: `${position * zoom}px` })
        }}
      >
        Remove
      </button>
    </>
  );
}

function ShadowOverlay({ observation, zoom }) {
  return (
    <>
      {observation.candidatePositions.horizontal.map((position, index) => (
        <div
          key={`shadow-horizontal-${index}`}
          data-testid="shadow-horizontal-overlay"
          style={{
            position: "absolute",
            zIndex: 3,
            left: 0,
            right: 0,
            top: `${position * zoom}px`,
            borderTop: "1px dashed #b45309"
          }}
        />
      ))}
      {observation.candidatePositions.vertical.map((position, index) => (
        <div
          key={`shadow-vertical-${index}`}
          data-testid="shadow-vertical-overlay"
          style={{
            position: "absolute",
            zIndex: 3,
            top: 0,
            bottom: 0,
            left: `${position * zoom}px`,
            borderLeft: "1px dashed #92400e"
          }}
        />
      ))}
    </>
  );
}

function findShadowComparison(validationReport, itemId) {
  const item = validationReport?.items?.find(candidate => candidate.itemId === itemId);
  return item?.comparisons?.find(candidate => (
    candidate?.normalizedObservation?.candidatePositions
  )) ?? null;
}

function formatComparisonState(comparison) {
  if (comparison?.status !== "compared") {
    return comparison?.status || "unavailable";
  }

  return comparison.exact ? "exact" : "different";
}

function getSurfacePoint(event, surface, zoom, rendered) {
  const bounds = surface?.getBoundingClientRect?.() ?? { left: 0, top: 0 };

  return {
    x: roundHalfPixel(clamp((event.clientX - bounds.left) / zoom, 0, rendered.width)),
    y: roundHalfPixel(clamp((event.clientY - bounds.top) / zoom, 0, rendered.height))
  };
}

function createDraftLines(start, end, intervalCount) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Grid boundary end must be greater than its start");
  }

  const positions = Array.from({ length: intervalCount + 1 }, (_, index) => (
    roundHalfPixel(start + (((end - start) * index) / intervalCount))
  ));

  if (positions.some((position, index) => (
    index > 0 && position <= positions[index - 1]
  ))) {
    throw new Error("Draft grid lines must remain strictly increasing");
  }

  return positions;
}

function insertPosition(lines, position) {
  if (lines.includes(position)) {
    return lines;
  }

  return [...lines, position].sort((left, right) => left - right);
}

function clampLinePosition(position, lines, index, maximum) {
  const minimum = index === 0 ? 0 : lines[index - 1] + HALF_PIXEL;
  const upper = index === lines.length - 1
    ? maximum
    : lines[index + 1] - HALF_PIXEL;

  return clamp(position, minimum, upper);
}

function hasCompleteBoundaries(boundaries) {
  return ["top", "bottom", "left", "right"].every(key => (
    Number.isFinite(boundaries[key])
  ));
}

function createEmptyBoundaries() {
  return {
    top: null,
    bottom: null,
    left: null,
    right: null
  };
}

function roundHalfPixel(value) {
  return Math.round(value * 2) / 2;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isLocalHostname(hostname) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "[::1]"
    || hostname === "::1";
}
