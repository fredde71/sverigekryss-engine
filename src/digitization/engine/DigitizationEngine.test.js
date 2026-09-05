import { createDigitizationJob } from "../domain/DigitizationJob";
import {
  createDigitizationEngine,
  runDigitizationJob
} from "./DigitizationEngine";

test("constructs normalized production evidence and exposes reconstruction unchanged", async () => {
  const context = {
    coordinateProvenance: {
      spaces: { local: "analysis-region-local" },
      analysisRegion: {
        id: "compatibility-full-binary-image",
        localToBinaryImage: {
          offsetX: 0,
          offsetY: 0,
          scaleX: 1,
          scaleY: 1
        }
      },
      documentAnalysis: {
        binaryImageToDocument: { scaleX: 0.5, scaleY: 0.5 }
      }
    },
    lineCandidates: { horizontal: [], vertical: [] },
    gridDetection: { diagnostics: [] }
  };
  const detectionResult = {
    context,
    gridDetection: { geometry: null, confidence: "missing-grid-geometry" },
    suggestions: [],
    diagnostics: []
  };
  const evidence = {
    type: "grid-lattice-evidence",
    coordinateSystem: {
      space: "analysis-region-local",
      localToBinaryImage:
        context.coordinateProvenance.analysisRegion.localToBinaryImage,
      binaryImageToDocument:
        context.coordinateProvenance.documentAnalysis.binaryImageToDocument
    }
  };
  const interpretations = {
    axes: { horizontal: null, vertical: null },
    evidenceReferences: ["production-interpretations"],
    interpretationEvidenceReferences: {
      horizontal: [],
      vertical: []
    },
    interpretationProvenance: { horizontal: [], vertical: [] },
    provenance: { source: "production-grid-analysis" }
  };
  const primitivePeriodEvidence = { id: "primitive-period-evidence" };
  const factoredBounds = { regionId: "compatibility-full-binary-image" };
  const boundsProjection = {
    providers: [{ regions: [factoredBounds] }]
  };
  const reconstructionResult = {
    type: "grid-lattice-reconstruction-result",
    status: "available",
    lattice: { type: "grid-lattice", status: "available" }
  };
  const createEvidence = jest.fn(() => evidence);
  const createLatticeInterpretations = jest.fn(() => interpretations);
  const createPrimitivePeriodEvidence = jest.fn(
    () => primitivePeriodEvidence
  );
  const createFactoredBoundsEvidence = jest.fn(() => boundsProjection);
  const outerVisualExtent = {
    type: "outer-visual-extent",
    status: "unavailable"
  };
  const createVisualExtent = jest.fn(() => outerVisualExtent);
  const reconstructGridLattice = jest.fn(() => reconstructionResult);
  const run = createDigitizationEngine({
    detectGrid: jest.fn(async () => detectionResult),
    createEvidence,
    createLatticeInterpretations,
    createPrimitivePeriodEvidence,
    createFactoredBoundsEvidence,
    createVisualExtent,
    reconstructGridLattice
  });

  const result = await run({
    job: { jobId: "job-production", source: { id: "source-production" } },
    readImageData: jest.fn()
  });

  expect(createEvidence).toHaveBeenCalledWith({ analysisContext: context });
  expect(createLatticeInterpretations).toHaveBeenCalledWith({
    analysisContext: context,
    evidence
  });
  expect(createPrimitivePeriodEvidence).toHaveBeenCalledWith({
    id: "production-grid-lattice-primitive-period-evidence",
    interpretationDiagnostics: interpretations.axes,
    coordinateScaleByAxis: { horizontal: 1, vertical: 1 },
    evidenceReferences: interpretations.evidenceReferences,
    interpretationEvidenceReferences:
      interpretations.interpretationEvidenceReferences,
    interpretationProvenance: interpretations.interpretationProvenance,
    provenance: interpretations.provenance
  });
  expect(createFactoredBoundsEvidence).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceId: "production-outer-line-geometry-evidence",
      coordinateSystem: expect.objectContaining({
        space: "analysis-region-local",
        localToBinaryImage:
          context.coordinateProvenance.analysisRegion.localToBinaryImage,
        binaryImageToDocument:
          context.coordinateProvenance.documentAnalysis.binaryImageToDocument
      })
    })
  );
  expect(createVisualExtent).toHaveBeenCalledWith({
    outerLineGeometryObservation: null
  });
  expect(reconstructGridLattice).toHaveBeenCalledWith({
    evidence,
    primitivePeriodEvidence,
    factoredBounds
  });
  expect(result.gridLatticeReconstructionResult).toBe(reconstructionResult);
  expect(result.outerVisualExtent).toBe(outerVisualExtent);
});

test("feeds observed parent-image outer-line geometry into factored bounds", async () => {
  const parentBinaryImage = createBinaryGrid({
    width: 17,
    height: 17,
    darkRows: [3, 4, 12, 13],
    darkCols: [3, 4, 12, 13]
  });
  const transform = {
    offsetX: 4,
    offsetY: 4,
    scaleX: 1,
    scaleY: 1
  };
  const coordinateSystem = {
    space: "analysis-region-local",
    unit: "pixel",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    localToBinaryImage: transform,
    binaryImageToDocument: { scaleX: 1, scaleY: 1 }
  };
  const context = {
    documentBinaryImage: parentBinaryImage,
    binaryImage: { width: 9, height: 9, data: new Uint8Array(81) },
    coordinateProvenance: {
      spaces: { local: "analysis-region-local" },
      analysisRegion: {
        id: "production-region",
        relationshipType: "translation",
        localToBinaryImage: transform
      },
      documentAnalysis: {
        binaryImageToDocument: { scaleX: 1, scaleY: 1 }
      }
    },
    lineCandidates: {
      horizontal: [createCandidate(0), createCandidate(8)],
      vertical: [createCandidate(0), createCandidate(8)]
    },
    gridDetection: { diagnostics: [] }
  };
  const createFactoredBoundsEvidence = jest.fn(() => ({
    providers: [{ regions: [{ id: "factored-region" }] }]
  }));
  const run = createDigitizationEngine({
    detectGrid: jest.fn(async () => ({
      context,
      gridDetection: { geometry: null },
      suggestions: [],
      diagnostics: []
    })),
    createEvidence: jest.fn(() => ({ coordinateSystem })),
    createLatticeInterpretations: jest.fn(() => ({
      axes: { horizontal: null, vertical: null },
      evidenceReferences: [],
      interpretationEvidenceReferences: { horizontal: [], vertical: [] },
      interpretationProvenance: { horizontal: [], vertical: [] },
      provenance: {}
    })),
    createPrimitivePeriodEvidence: jest.fn(() => ({ id: "periods" })),
    createFactoredBoundsEvidence,
    reconstructGridLattice: jest.fn(() => ({
      type: "grid-lattice-reconstruction-result",
      status: "unavailable",
      lattice: null
    }))
  });

  const result = await run({
    job: { jobId: "geometry", source: { id: "source" } },
    readImageData: jest.fn()
  });

  const input = createFactoredBoundsEvidence.mock.calls[0][0];
  const observation = input.providers[0].regions[0].observation;
  expect(observation.edges.top).toMatchObject({
    acceptedCandidateCenter: 0,
    acceptedCenterInParentBinaryImage: 4,
    geometry: {
      contiguousStrongOrFullLineRun: {
        midpoint: { position: -0.5 }
      },
      projectionPlateau: {
        midpoint: { position: -0.5 }
      },
      firstStrongOrFullContinuityPosition: { position: -1 },
      lastStrongOrFullContinuityPosition: { position: 0 }
    }
  });
  expect(input.coordinateSystem).toBe(coordinateSystem);
  expect(result.outerVisualExtent).toMatchObject({
    type: "outer-visual-extent",
    status: "available",
    bounds: { top: -1, left: -1, width: 10, height: 10 }
  });
  expect(result.outerVisualExtent.coordinateSystem).toEqual(coordinateSystem);
});

test("marks production outer geometry unavailable when parent image evidence is missing", async () => {
  const coordinateSystem = {
    space: "analysis-region-local",
    localToBinaryImage: {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1
    },
    binaryImageToDocument: { scaleX: 1, scaleY: 1 }
  };
  const context = {
    binaryImage: { width: 9, height: 9, data: new Uint8Array(81) },
    coordinateProvenance: {
      spaces: { local: "analysis-region-local" },
      analysisRegion: {
        id: "production-region",
        relationshipType: "identity",
        localToBinaryImage: coordinateSystem.localToBinaryImage
      },
      documentAnalysis: {
        binaryImageToDocument: coordinateSystem.binaryImageToDocument
      }
    },
    lineCandidates: {
      horizontal: [createCandidate(0), createCandidate(8)],
      vertical: [createCandidate(0), createCandidate(8)]
    },
    gridDetection: { diagnostics: [] }
  };
  const createFactoredBoundsEvidence = jest.fn(() => ({
    providers: [{ regions: [{ id: "unavailable-region" }] }]
  }));
  const run = createDigitizationEngine({
    detectGrid: jest.fn(async () => ({
      context,
      gridDetection: { geometry: null },
      suggestions: [],
      diagnostics: []
    })),
    createEvidence: jest.fn(() => ({ coordinateSystem })),
    createLatticeInterpretations: jest.fn(() => ({
      axes: { horizontal: null, vertical: null },
      evidenceReferences: [],
      interpretationEvidenceReferences: { horizontal: [], vertical: [] },
      interpretationProvenance: { horizontal: [], vertical: [] },
      provenance: {}
    })),
    createPrimitivePeriodEvidence: jest.fn(() => ({ id: "periods" })),
    createFactoredBoundsEvidence,
    reconstructGridLattice: jest.fn(() => ({
      type: "grid-lattice-reconstruction-result",
      status: "unavailable",
      lattice: null
    }))
  });

  const result = await run({
    job: { jobId: "missing-parent", source: { id: "source" } },
    readImageData: jest.fn()
  });

  expect(createFactoredBoundsEvidence.mock.calls[0][0].providers[0])
    .toMatchObject({
      status: "unavailable",
      reason: "parent-binary-image-neighborhood-unavailable",
      regions: [{
        status: "unavailable",
        reason: "parent-binary-image-neighborhood-unavailable",
        observation: null
      }]
    });
  expect(result.outerVisualExtent).toMatchObject({
    type: "outer-visual-extent",
    status: "unavailable",
    bounds: null,
    reasons: ["outer-line-geometry-observation-unavailable"]
  });
});

test.each(["ambiguous", "unavailable"])(
  "preserves a %s reconstruction result without fabricating a lattice",
  async status => {
    const reconstructionResult = {
      type: "grid-lattice-reconstruction-result",
      status,
      lattice: null
    };
    const run = createDigitizationEngine({
      detectGrid: jest.fn(async () => ({
        context: {
          coordinateProvenance: null,
          lineCandidates: { horizontal: [], vertical: [] },
          gridDetection: { diagnostics: [] }
        },
        gridDetection: { geometry: null },
        suggestions: [],
        diagnostics: []
      })),
      createEvidence: jest.fn(() => ({ coordinateSystem: {} })),
      createLatticeInterpretations: jest.fn(() => ({
        axes: { horizontal: null, vertical: null },
        evidenceReferences: [],
        interpretationEvidenceReferences: { horizontal: [], vertical: [] },
        interpretationProvenance: { horizontal: [], vertical: [] },
        provenance: {}
      })),
      createPrimitivePeriodEvidence: jest.fn(() => ({})),
      createFactoredBoundsEvidence: jest.fn(() => ({
        providers: [{ regions: [{}] }]
      })),
      reconstructGridLattice: jest.fn(() => reconstructionResult)
    });

    const result = await run({
      job: { jobId: `job-${status}`, source: { id: `source-${status}` } },
      readImageData: jest.fn()
    });

    expect(result.gridLatticeReconstructionResult).toBe(reconstructionResult);
    expect(result.gridLatticeReconstructionResult.lattice).toBeNull();
  }
);

test("runDigitizationJob orchestrates a single job through image grid detection", async () => {
  const result = await runDigitizationJob({
    job: createDigitizationJob({
      jobId: "job-1",
      source: {
        id: "source-1"
      }
    }),
    readImageData: jest.fn(async () => createRgbaImage({
      width: 5,
      height: 5,
      darkRows: [0, 2, 4],
      darkCols: [0, 2, 4]
    }))
  });

  expect(result).toMatchObject({
    jobId: "job-1",
    sourceId: "source-1",
    status: "completed",
    gridDetection: {
      confidence: "detected",
      geometry: {
        rows: 2,
        cols: 2
      },
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          type: "candidate-counts",
          axis: "horizontal",
          acceptedCount: 3,
          rejectedCount: 2,
          totalCount: 5
        }),
        expect.objectContaining({
          type: "candidate-counts",
          axis: "vertical",
          acceptedCount: 3,
          rejectedCount: 2,
          totalCount: 5
        }),
        expect.objectContaining({
          type: "acceptance-status",
          accepted: true
        })
      ])
    },
    diagnostics: expect.arrayContaining([
      expect.objectContaining({
        type: "candidate-counts",
        axis: "horizontal",
        acceptedCount: 3,
        rejectedCount: 2,
        totalCount: 5
      }),
      expect.objectContaining({
        type: "candidate-counts",
        axis: "vertical",
        acceptedCount: 3,
        rejectedCount: 2,
        totalCount: 5
      }),
      expect.objectContaining({
        type: "acceptance-status",
        accepted: true
      })
    ])
  });
  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0]).toMatchObject({
    sourceId: "source-1",
    confidence: "detected"
  });
  expect(result.context.coordinateProvenance).toEqual({
    type: "digitization-coordinate-provenance",
    version: 1,
    spaces: {
      local: "analysis-region-local",
      binaryImage: "binary-image-pixels",
      document: "document"
    },
    analysisRegion: {
      id: "production-horizontal-outer-span-001",
      regionType: "production-analysis-region",
      relationshipType: "translation",
      localToBinaryImage: {
        offsetX: 0,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1
      },
      owner: "analysis-region"
    },
    documentAnalysis: {
      type: "document-analysis",
      version: 1,
      relationshipType: "axis-aligned-scale",
      binaryImageToDocument: {
        scaleX: 1,
        scaleY: 1
      },
      owner: "document-analysis"
    }
  });
  expect(Object.isFrozen(result.context.coordinateProvenance)).toBe(true);
  expect(Object.isFrozen(
    result.context.coordinateProvenance.analysisRegion.localToBinaryImage
  )).toBe(true);
});

test("runDigitizationJob preserves diagnostics and empty suggestions when grid is missing", async () => {
  const result = await runDigitizationJob({
    job: createDigitizationJob({
      jobId: "job-empty",
      source: {
        id: "empty-source"
      }
    }),
    readImageData: jest.fn(async () => createRgbaImage({
      width: 5,
      height: 5
    }))
  });

  expect(result.suggestions).toEqual([]);
  expect(result.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: "candidate-counts",
      axis: "horizontal",
      acceptedCount: 0,
      rejectedCount: 0,
      totalCount: 0
    }),
    expect.objectContaining({
      type: "candidate-counts",
      axis: "vertical",
      acceptedCount: 0,
      rejectedCount: 0,
      totalCount: 0
    }),
    expect.objectContaining({
      type: "rejection-reason",
      axis: "horizontal",
      candidateCount: 0,
      minimumCount: 2
    }),
    expect.objectContaining({
      type: "rejection-reason",
      axis: "vertical",
      candidateCount: 0,
      minimumCount: 2
    }),
    expect.objectContaining({
      type: "acceptance-status",
      accepted: false
    })
  ]));
  expect(result.gridDetection).toEqual({
    geometry: null,
    confidence: "missing-grid-geometry",
    diagnostics: result.diagnostics
  });
});

test("runDigitizationJob propagates readImageData errors", async () => {
  const error = new Error("read failed");

  await expect(
    runDigitizationJob({
      job: createDigitizationJob({
        jobId: "job-error",
        source: {
          id: "source-error"
        }
      }),
      readImageData: jest.fn(async () => {
        throw error;
      })
    })
  ).rejects.toThrow("read failed");
});

test("runDigitizationJob is deterministic for equivalent image input", async () => {
  const job = createDigitizationJob({
    jobId: "job-deterministic",
    source: {
      id: "source-deterministic"
    }
  });
  const readImageData = jest.fn(async () => createRgbaImage({
    width: 5,
    height: 5,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  }));

  const first = await runDigitizationJob({
    job,
    readImageData
  });
  const second = await runDigitizationJob({
    job,
    readImageData
  });

  expect(first.gridDetection).toEqual(second.gridDetection);
  expect(first.suggestions).toEqual(second.suggestions);
  expect(first.diagnostics).toEqual(second.diagnostics);
});

test("runDigitizationJob does not mutate job, source, options or image data", async () => {
  const source = {
    id: "source-immutable",
    metadata: {
      name: "source"
    }
  };
  const options = {
    threshold: 128
  };
  const imageData = createRgbaImage({
    width: 5,
    height: 5,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  });
  const originalPixels = Array.from(imageData.data);
  const job = createDigitizationJob({
    jobId: "job-immutable",
    source,
    options
  });

  await runDigitizationJob({
    job,
    readImageData: jest.fn(async () => imageData)
  });

  expect(job).toEqual({
    jobId: "job-immutable",
    source: {
      id: "source-immutable",
      metadata: {
        name: "source"
      }
    },
    options: {
      threshold: 128
    }
  });
  expect(source.metadata.name).toBe("source");
  expect(options.threshold).toBe(128);
  expect(Array.from(imageData.data)).toEqual(originalPixels);
});

test("runDigitizationJob requires a source", async () => {
  await expect(
    runDigitizationJob({
      job: createDigitizationJob({
        jobId: "missing-source"
      }),
      readImageData: jest.fn()
    })
  ).rejects.toThrow("DigitizationJob source is required");
});

function createRgbaImage({
  width,
  height,
  darkRows = [],
  darkCols = []
}) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const isDark = darkRows.includes(y) || darkCols.includes(x);
      const value = isDark ? 0 : 255;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return {
    width,
    height,
    data
  };
}

function createBinaryGrid({ width, height, darkRows, darkCols }) {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[(y * width) + x] = darkRows.includes(y) || darkCols.includes(x)
        ? 1
        : 0;
    }
  }
  return { width, height, data };
}

function createCandidate(position) {
  return {
    position,
    start: position,
    end: position,
    thickness: 1,
    strength: 9,
    averageStrength: 9
  };
}
