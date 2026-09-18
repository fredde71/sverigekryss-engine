import { createTemplate } from "../template/templateModel";
import {
  getFullDocumentArea,
  normalizeDocumentSize
} from "../template/documentGeometry";
import { createEmptyMusikkryssContent } from "./MusikkryssFormat";
import { getMusikkryssFormat } from "./MusikkryssFormatCatalog";
import { CELL_TYPE_BLACK } from "../template/cellTypes";

export function createMusikkryssTemplate({
  formatId,
  formatCatalog,
  crosswordId = "",
  documentSize,
  imageSrc = ""
} = {}) {
  const format = getMusikkryssFormat(formatId, formatCatalog);
  if (!format) {
    throw new Error("Unknown Musikkryss format");
  }

  const safeDocumentSize = normalizeDocumentSize(documentSize);
  const gridArea = materializeGridArea({
    normalizedGridArea: format.normalizedDocumentGridArea,
    documentSize: safeDocumentSize
  });
  const rows = format.gridDimensions.rows;
  const cols = format.gridDimensions.cols;
  const musikkryss = createEmptyMusikkryssContent(format);

  const template = createTemplate({
    crosswordId,
    crosswordType: "musikkryss",
    rows,
    cols,
    cellTypes: format.cellTopology.map(cell => (
      cell === "writable" ? "write" : CELL_TYPE_BLACK
    )),
    gridArea,
    cropArea: getFullDocumentArea(safeDocumentSize),
    documentSize: safeDocumentSize,
    imageSrc,
    horizontalLinePositions: materializeLinePositions({
      normalizedPositions:
        format.gridGeometry.axes.horizontal.normalizedLinePositions,
      start: gridArea.top,
      span: gridArea.height
    }),
    verticalLinePositions: materializeLinePositions({
      normalizedPositions:
        format.gridGeometry.axes.vertical.normalizedLinePositions,
      start: gridArea.left,
      span: gridArea.width
    }),
    musikkryss
  });

  return {
    ...template,
    musikkryss
  };
}

function materializeGridArea({ normalizedGridArea, documentSize }) {
  return {
    top: normalizedGridArea.top * documentSize.height,
    left: normalizedGridArea.left * documentSize.width,
    width: normalizedGridArea.width * documentSize.width,
    height: normalizedGridArea.height * documentSize.height
  };
}

function materializeLinePositions({ normalizedPositions, start, span }) {
  return normalizedPositions.map(position => start + position * span);
}
