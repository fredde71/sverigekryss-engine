import { createTemplateSolutionIndex } from "../template/templateSolutions";
import {
  applySolutionReveal,
  createSolutionRevealState,
  SOLUTION_REVEAL_ACTIONS
} from "./solutionReveal";

const solutionIndex = createTemplateSolutionIndex({
  crosswordType: "sverigekryss",
  cellTypes: ["double", "write", "write", "write", "write"],
  answerPaths: [{
    clueIndex: 0,
    paths: [
      { direction: "across", cellIndexes: [1, 2], solution: "AB" },
      { direction: "down", cellIndexes: [1, 3, 4], solution: "ACD" }
    ]
  }]
});

test("reveals one canonical letter in selected path order", () => {
  const first = applySolutionReveal({
    state: createSolutionRevealState(),
    action: SOLUTION_REVEAL_ACTIONS.LETTER,
    answerCellIndexes: [1, 2],
    solutionIndex
  });
  const second = applySolutionReveal({
    state: first,
    action: SOLUTION_REVEAL_ACTIONS.LETTER,
    answerCellIndexes: [1, 2],
    solutionIndex
  });

  expect(first.cellLetters).toEqual({ 1: "A" });
  expect(second.cellLetters).toEqual({ 1: "A", 2: "B" });
});

test("answer and full reveals share crossing cell letters", () => {
  const answer = applySolutionReveal({
    state: createSolutionRevealState(),
    action: SOLUTION_REVEAL_ACTIONS.ANSWER,
    answerCellIndexes: [1, 3, 4],
    solutionIndex
  });
  const all = applySolutionReveal({
    state: answer,
    action: SOLUTION_REVEAL_ACTIONS.ALL,
    solutionIndex
  });

  expect(answer.cellLetters).toEqual({ 1: "A", 3: "C", 4: "D" });
  expect(all.cellLetters).toEqual({ 1: "A", 2: "B", 3: "C", 4: "D" });
  expect(Object.isFrozen(all.cellLetters)).toBe(true);
});
