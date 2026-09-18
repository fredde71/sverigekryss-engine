import {
  MUSIKKRYSS_FIXED_FORMAT,
  normalizeMusikkryssContent
} from "./MusikkryssFormat";

export const MUSIKKRYSS_FORMAT_CATALOG = Object.freeze({
  type: "musikkryss-format-catalog",
  version: 1,
  defaultFormatId: MUSIKKRYSS_FIXED_FORMAT.id,
  formats: Object.freeze([MUSIKKRYSS_FIXED_FORMAT])
});

export function getMusikkryssFormat(
  formatId,
  catalog = MUSIKKRYSS_FORMAT_CATALOG
) {
  const selectedFormatId = formatId ?? catalog.defaultFormatId;

  return catalog.formats.find(
    format => format.id === selectedFormatId
  ) || null;
}

export function normalizeCatalogMusikkryssContent(
  value,
  catalog = MUSIKKRYSS_FORMAT_CATALOG
) {
  const format = getMusikkryssFormat(value?.formatId, catalog);
  return normalizeMusikkryssContent(value, format || undefined);
}
