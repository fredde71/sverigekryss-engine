import { MUSIKKRYSS_FIXED_FORMAT } from "./MusikkryssFormat";
import { createMusikkryssTemplate } from "./MusikkryssTemplateInitializer";

test("initializes a durable template from the fixed 10 by 9 format", () => {
  const template = createMusikkryssTemplate({
    crosswordId: "musik-2026-38",
    documentSize: { width: 980, height: 1080 },
    imageSrc: "data:image/png;base64,fixture"
  });

  expect(template.crosswordType).toBe("musikkryss");
  expect(template.rows).toBe(9);
  expect(template.cols).toBe(10);
  expect(template.gridArea).toEqual({
    top: 60,
    left: 40,
    width: 900,
    height: 810
  });
  expect(template.horizontalLinePositions).toEqual(
    Array.from({ length: 10 }, (_, index) => 60 + index * 90)
  );
  expect(template.verticalLinePositions).toEqual(
    Array.from({ length: 11 }, (_, index) => 40 + index * 90)
  );
  expect(template.cellTypes.filter(value => value === "write")).toHaveLength(59);
  expect(template.cellTypes.filter(value => value === "empty")).toHaveLength(31);
  expect(template).not.toHaveProperty("answerPaths");
  expect(template.musikkryss.introScript).toBe("");
  expect(template.musikkryss.answers).toHaveLength(15);
  expect(template.musikkryss.answers.every(answer => (
    answer.contentSequence[0].text === ""
  ))).toBe(true);
  expect(template.musikkryss.answers.every(answer => (
    answer.answerPath.length >= 2
  ))).toBe(true);
  expect(template.musikkryss.answers.filter(answer => answer.number === 1))
    .toEqual([
      expect.objectContaining({ direction: "across" }),
      expect.objectContaining({ direction: "down" })
    ]);
});

test("copies format topology without sharing mutable template data", () => {
  const template = createMusikkryssTemplate({
    documentSize: { width: 490, height: 540 }
  });

  template.cellTypes[0] = "empty";
  template.horizontalLinePositions[0] = -1;

  expect(MUSIKKRYSS_FIXED_FORMAT.cellTopology[0]).toBe("writable");
  expect(
    MUSIKKRYSS_FIXED_FORMAT.gridGeometry.axes.horizontal.normalizedLinePositions[0]
  ).toBe(0);
});

test("rejects an unknown format instead of fabricating topology", () => {
  expect(() => createMusikkryssTemplate({
    formatId: "missing-format",
    documentSize: { width: 490, height: 540 }
  })).toThrow("Unknown Musikkryss format");
});
