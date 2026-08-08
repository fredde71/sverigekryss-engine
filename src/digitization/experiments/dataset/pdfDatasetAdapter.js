import * as pdfjsLib from "pdfjs-dist";
import { readBrowserImageData } from "../../adapters/browserImageDataReader";
import { getDocumentSizeForDimensions } from "../../../template/documentGeometry";

const PDF_PAGE_NUMBER = 1;
const PDF_RENDER_SCALE = 2;

export function createPdfDatasetAdapter({
  getDocument = options => pdfjsLib.getDocument(options),
  documentRef = typeof document === "undefined" ? null : document,
  readImageData = readBrowserImageData,
  getDocumentSize = getDocumentSizeForDimensions
} = {}) {
  validateFunction(getDocument, "getDocument");
  validateFunction(readImageData, "readImageData");
  validateFunction(getDocumentSize, "getDocumentSize");

  if (!documentRef || typeof documentRef.createElement !== "function") {
    throw new Error("document.createElement is required");
  }

  return async function preparePdfDatasetInput(item) {
    const file = validateItem(item);
    const arrayBuffer = await readPdfBytes(file);
    const pdf = await loadPdf(getDocument, arrayBuffer);
    const page = await loadFirstPage(pdf);
    const viewport = createUploadViewport(page);
    const {
      canvas,
      context
    } = createRenderCanvas(documentRef, viewport);

    await renderPage(page, context, viewport);

    const documentSize = getDocumentSize({
      width: viewport.width,
      height: viewport.height
    });

    validateDocumentSize(documentSize);

    return {
      source: canvas,
      readImageData,
      productionOptions: {
        documentSize
      }
    };
  };
}

export const preparePdfDatasetInput = createPdfDatasetAdapter();

function validateItem(item) {
  if (!item || typeof item !== "object") {
    throw new Error("PDF dataset item is required");
  }

  if (!item.input || typeof item.input !== "object") {
    throw new Error("PDF dataset item input is required");
  }

  if (item.input.kind !== "pdf") {
    throw new Error('PDF dataset item input kind must be "pdf"');
  }

  if (
    item.input.pageNumber !== undefined
    && item.input.pageNumber !== PDF_PAGE_NUMBER
  ) {
    throw new Error("PDF dataset adapter supports page 1 only");
  }

  const file = item.input.file;

  if (!file || typeof file !== "object") {
    throw new Error("PDF file is required");
  }

  if (typeof file.arrayBuffer !== "function") {
    throw new Error("PDF file arrayBuffer is required");
  }

  if (
    typeof file.type === "string"
    && file.type.length > 0
    && file.type !== "application/pdf"
  ) {
    throw new Error("PDF file type must be application/pdf");
  }

  return file;
}

async function readPdfBytes(file) {
  let arrayBuffer;

  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (error) {
    throw createStageError("Failed to read PDF file", error);
  }

  if (!isArrayBuffer(arrayBuffer)) {
    throw new Error("PDF file arrayBuffer must return an ArrayBuffer");
  }

  if (arrayBuffer.byteLength === 0) {
    throw new Error("PDF file must not be empty");
  }

  return arrayBuffer;
}

async function loadPdf(getDocument, arrayBuffer) {
  let loadingTask;

  try {
    loadingTask = getDocument({
      data: arrayBuffer
    });
  } catch (error) {
    throw createStageError("Failed to load PDF", error);
  }

  if (!loadingTask || !isPromiseLike(loadingTask.promise)) {
    throw new Error("PDF loading task promise is required");
  }

  try {
    const pdf = await loadingTask.promise;

    if (!pdf || typeof pdf.getPage !== "function") {
      throw new Error("Loaded PDF getPage is required");
    }

    return pdf;
  } catch (error) {
    throw createStageError("Failed to load PDF", error);
  }
}

async function loadFirstPage(pdf) {
  try {
    return await pdf.getPage(PDF_PAGE_NUMBER);
  } catch (error) {
    throw createStageError("Failed to load PDF page 1", error);
  }
}

function createUploadViewport(page) {
  if (!page || typeof page.getViewport !== "function") {
    throw new Error("PDF page getViewport is required");
  }

  if (typeof page.render !== "function") {
    throw new Error("PDF page render is required");
  }

  let viewport;

  try {
    viewport = page.getViewport({
      scale: PDF_RENDER_SCALE
    });
  } catch (error) {
    throw createStageError("Failed to create PDF page 1 viewport", error);
  }

  if (
    !Number.isFinite(viewport?.width)
    || viewport.width <= 0
    || !Number.isFinite(viewport?.height)
    || viewport.height <= 0
  ) {
    throw new Error("PDF page viewport dimensions must be positive numbers");
  }

  return viewport;
}

function createRenderCanvas(documentRef, viewport) {
  const canvas = documentRef.createElement("canvas");

  if (!canvas || typeof canvas.getContext !== "function") {
    throw new Error("HTML canvas is required");
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d");

  if (!context || typeof context.getImageData !== "function") {
    throw new Error("Canvas 2D context with getImageData is required");
  }

  return {
    canvas,
    context
  };
}

async function renderPage(page, context, viewport) {
  let renderTask;

  try {
    renderTask = page.render({
      canvasContext: context,
      viewport
    });
  } catch (error) {
    throw createStageError("Failed to render PDF page 1", error);
  }

  if (!renderTask || !isPromiseLike(renderTask.promise)) {
    throw new Error("PDF render task promise is required");
  }

  try {
    await renderTask.promise;
  } catch (error) {
    throw createStageError("Failed to render PDF page 1", error);
  }
}

function validateDocumentSize(documentSize) {
  if (
    !Number.isFinite(documentSize?.width)
    || documentSize.width <= 0
    || !Number.isFinite(documentSize?.height)
    || documentSize.height <= 0
  ) {
    throw new Error("PDF documentSize must contain positive dimensions");
  }
}

function validateFunction(value, name) {
  if (typeof value !== "function") {
    throw new Error(`${name} must be a function`);
  }
}

function isArrayBuffer(value) {
  return value instanceof ArrayBuffer
    || Object.prototype.toString.call(value) === "[object ArrayBuffer]";
}

function isPromiseLike(value) {
  return value !== null && typeof value?.then === "function";
}

function createStageError(message, error) {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`${message}: ${detail}`);
}
