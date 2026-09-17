import { MUSIKKRYSS_FIXED_FORMAT } from "./MusikkryssFormat";

export const MUSIKKRYSS_FORMAT_CATALOG = Object.freeze({
  type: "musikkryss-format-catalog",
  version: 1,
  defaultFormatId: MUSIKKRYSS_FIXED_FORMAT.id,
  formats: Object.freeze([MUSIKKRYSS_FIXED_FORMAT])
});

export function getMusikkryssFormat(
  formatId = MUSIKKRYSS_FORMAT_CATALOG.defaultFormatId
) {
  return MUSIKKRYSS_FORMAT_CATALOG.formats.find(
    format => format.id === formatId
  ) || null;
}
