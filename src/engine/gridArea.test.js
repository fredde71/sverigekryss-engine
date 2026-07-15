import { moveGridArea } from "./gridArea";

test("moveGridArea updates top and left correctly", () => {
  const gridArea = {
    top: 10,
    left: 20,
    width: 300,
    height: 400
  };

  expect(moveGridArea(gridArea, 5, -3)).toEqual({
    top: 7,
    left: 25,
    width: 300,
    height: 400
  });
});

test("moveGridArea preserves width and height", () => {
  const gridArea = {
    top: 10,
    left: 20,
    width: 300,
    height: 400
  };

  const moved = moveGridArea(gridArea, 100, 200);

  expect(moved.width).toBe(300);
  expect(moved.height).toBe(400);
});

test("moveGridArea does not mutate the original object", () => {
  const gridArea = {
    top: 10,
    left: 20,
    width: 300,
    height: 400
  };

  const moved = moveGridArea(gridArea, 5, 6);

  expect(moved).not.toBe(gridArea);
  expect(gridArea).toEqual({
    top: 10,
    left: 20,
    width: 300,
    height: 400
  });
});
