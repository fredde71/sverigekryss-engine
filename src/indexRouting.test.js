import { readFileSync } from "fs";

const indexSource = readFileSync(`${__dirname}/index.js`, "utf8");

test("exposes Digitization Lab through a development-only route", () => {
  expect(indexSource).toContain(
    "const isDigitizationLabEnvironment = [\"development\", \"test\"].includes("
  );
  expect(indexSource).toContain(
    "const DigitizationLabPage = isDigitizationLabEnvironment"
  );
  expect(indexSource).toContain(
    "import(\n    \"./digitization/experiments/DigitizationLabPage\""
  );
  expect(indexSource).toContain("path=\"/digitization-lab\"");
  expect(indexSource).toContain("{DigitizationLabPage && (");
});

test("production configuration does not expose the Lab component or route", () => {
  const guardStart = indexSource.indexOf(
    "const DigitizationLabPage = isDigitizationLabEnvironment"
  );
  const guardEnd = indexSource.indexOf(";", guardStart);
  const routeStart = indexSource.indexOf("{DigitizationLabPage && (");
  const routeEnd = indexSource.indexOf(")}", routeStart);

  expect(indexSource.slice(guardStart, guardEnd)).toContain(": null");
  expect(indexSource.slice(routeStart, routeEnd)).toContain(
    "path=\"/digitization-lab\""
  );
});
