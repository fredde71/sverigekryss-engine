import { readFileSync } from "fs";

const appSource = readFileSync(`${__dirname}/App.js`, "utf8");

test("editor preview TemplateCanvas remains uncropped", () => {
  const editModeCanvas = getSourceBetween(
    appSource,
    "{modeView === \"edit\" ? (",
    ") : ("
  );

  expect(editModeCanvas).toContain("<TemplateCanvas");
  expect(editModeCanvas).not.toContain("cropped");
});

test("local Play preview uses PlaySurface without responsive mode", () => {
  const localPlaySurface = getSourceBetween(
    appSource,
    ") : (",
    "</PlaySurface>"
  );

  expect(localPlaySurface).toContain("<PlaySurface");
  expect(localPlaySurface).not.toContain("responsive");
});

function getSourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  return source.slice(startIndex, endIndex);
}
