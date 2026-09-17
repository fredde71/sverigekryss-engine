import {
  getMusikkryssFormat,
  MUSIKKRYSS_FORMAT_CATALOG
} from "./MusikkryssFormatCatalog";
import { MUSIKKRYSS_FIXED_FORMAT } from "./MusikkryssFormat";

test("catalog exposes the recurring format deterministically", () => {
  expect(MUSIKKRYSS_FORMAT_CATALOG.defaultFormatId)
    .toBe(MUSIKKRYSS_FIXED_FORMAT.id);
  expect(getMusikkryssFormat()).toBe(MUSIKKRYSS_FIXED_FORMAT);
  expect(getMusikkryssFormat(MUSIKKRYSS_FIXED_FORMAT.id))
    .toBe(MUSIKKRYSS_FIXED_FORMAT);
  expect(getMusikkryssFormat("missing-format")).toBeNull();
  expect(Object.isFrozen(MUSIKKRYSS_FORMAT_CATALOG.formats)).toBe(true);
});
