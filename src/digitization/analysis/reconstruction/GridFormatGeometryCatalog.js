import { createGridFormatGeometry } from "./GridFormatGeometry";
import {
  deepFreeze,
  validateNonEmptyString
} from "./GridLatticeModelSupport";

const VERSION = 1;

export function createGridFormatGeometryCatalog({ id, formats } = {}) {
  validateNonEmptyString(id, "id");
  if (!Array.isArray(formats)) {
    throw new Error("formats must be an array");
  }

  const seenIds = new Set();
  const normalizedFormats = formats.map(format => {
    const normalized = createGridFormatGeometry(format);
    if (seenIds.has(normalized.id)) {
      throw new Error(`formats contains duplicate id ${normalized.id}`);
    }
    seenIds.add(normalized.id);
    return normalized;
  });

  return deepFreeze({
    type: "grid-format-geometry-catalog",
    version: VERSION,
    id,
    formats: normalizedFormats
  });
}

export const GRID_FORMAT_GEOMETRY_CATALOG = createGridFormatGeometryCatalog({
  id: "production-grid-format-geometries-v1",
  formats: [{
    id: "grid-format-25x25-v1",
    gridDimensions: {
      rows: 25,
      cols: 25
    },
    axes: {
      horizontal: {
        normalizedLinePositions: [
          0,
          0.043233743409490336,
          0.08260105448154657,
          0.1226713532513181,
          0.16239015817223199,
          0.20210896309314588,
          0.2421792618629174,
          0.2818980667838313,
          0.3216168717047452,
          0.3609841827768014,
          0.4014059753954306,
          0.4407732864674868,
          0.4804920913884007,
          0.5205623901581722,
          0.5602811950790861,
          0.5996485061511424,
          0.6397188049209139,
          0.6797891036906855,
          0.7191564147627416,
          0.7588752196836556,
          0.7992970123022847,
          0.8386643233743409,
          0.8783831282952548,
          0.9184534270650263,
          0.9578207381370826,
          1
        ]
      },
      vertical: {
        normalizedLinePositions: [
          0,
          0.0422237860661506,
          0.08163265306122448,
          0.12174524982406756,
          0.16185784658691063,
          0.20126671358198453,
          0.24102744546094299,
          0.2811400422237861,
          0.32054890921886,
          0.36066150598170305,
          0.40007037297677694,
          0.44018296973962,
          0.47994370161857847,
          0.5193525686136523,
          0.5591133004926109,
          0.5992258972554539,
          0.6389866291344124,
          0.6787473610133709,
          0.7188599577762139,
          0.7586206896551724,
          0.7980295566502463,
          0.8377902885292048,
          0.8779028852920479,
          0.9173117522871217,
          0.9577762139338494,
          1
        ]
      }
    },
    provenance: {
      source: "offline-confirmed-format-geometry-promotion",
      promotionVersion: 1
    }
  }]
});
