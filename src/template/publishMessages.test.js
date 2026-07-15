import {
  getPublishFailureMessage,
  getPublishSuccessMessage
} from "./publishMessages";

test("network publish failure shows user-facing feedback", () => {
  expect(
    getPublishFailureMessage(new Error("Network unavailable"))
  ).toBe("Publicering misslyckades: Network unavailable");
});

test("successful publish flow remains unchanged", () => {
  expect(
    getPublishSuccessMessage("http://localhost/play/TT-2026-0002")
  ).toBe("Publicerad! Öppna: http://localhost/play/TT-2026-0002");
});
