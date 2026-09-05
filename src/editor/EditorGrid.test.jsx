import { render, screen } from "@testing-library/react";
import EditorGrid from "./EditorGrid";

test("renders explicit reconstructed boundaries at their supplied positions", () => {
  render(
    <EditorGrid
      rows={2}
      cols={2}
      cellTypes={Array(4).fill("empty")}
      gridArea={{ top: 10, left: 20, width: 120, height: 100 }}
      gridLineProposal={{
        horizontalLinePositions: [11.5, 58.25, 109],
        verticalLinePositions: [21.5, 79.75, 138],
        referenceGridArea: { top: 10, left: 20, width: 120, height: 100 }
      }}
    />
  );

  expect(readLinePositions("horizontal", 3)).toEqual([1.5, 48.25, 99]);
  expect(readLinePositions("vertical", 3)).toEqual([1.5, 59.75, 118]);
  expect(screen.getByTestId("editor-grid-cell-0")).toHaveStyle({
    top: "1.5px",
    left: "1.5px",
    width: "58.25px",
    height: "46.75px"
  });
});

test("preserves every explicit interval instead of uniformly subdividing the frame", () => {
  render(
    <EditorGrid
      rows={2}
      cols={2}
      cellTypes={Array(4).fill("empty")}
      gridArea={{ top: 0, left: 0, width: 100, height: 100 }}
      gridLineProposal={{
        horizontalLinePositions: [2, 47, 98],
        verticalLinePositions: [3, 49, 97],
        referenceGridArea: { top: 0, left: 0, width: 100, height: 100 }
      }}
    />
  );

  expect(readLinePositions("horizontal", 3)).toEqual([2, 47, 98]);
  expect(readLinePositions("vertical", 3)).toEqual([3, 49, 97]);
  expect(readLinePositions("horizontal", 3)[1]).not.toBe(50);
  expect(readLinePositions("vertical", 3)[1]).not.toBe(50);
});

test("existing grids remain uniformly divided when explicit positions are absent", () => {
  render(
    <EditorGrid
      rows={2}
      cols={3}
      cellTypes={Array(6).fill("empty")}
      gridArea={{ top: 0, left: 0, width: 300, height: 200 }}
    />
  );

  expect(screen.getByTestId("editor-grid-uniform")).toHaveStyle({
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gridTemplateRows: "repeat(2, 1fr)"
  });
  expect(screen.queryByTestId("editor-grid-explicit")).not.toBeInTheDocument();
  expect(screen.queryByTestId("editor-grid-line-horizontal-0"))
    .not.toBeInTheDocument();
});

test("existing move and resize semantics affinely preserve explicit geometry", () => {
  const proposal = {
    horizontalLinePositions: [12, 60, 108],
    verticalLinePositions: [24, 80, 136],
    referenceGridArea: { top: 10, left: 20, width: 120, height: 100 }
  };
  const { rerender } = render(
    <EditorGrid
      rows={2}
      cols={2}
      cellTypes={Array(4).fill("empty")}
      gridArea={proposal.referenceGridArea}
      gridLineProposal={proposal}
    />
  );

  rerender(
    <EditorGrid
      rows={2}
      cols={2}
      cellTypes={Array(4).fill("empty")}
      gridArea={{ top: 30, left: 40, width: 240, height: 200 }}
      gridLineProposal={proposal}
    />
  );

  expect(readLinePositions("horizontal", 3)).toEqual([4, 100, 196]);
  expect(readLinePositions("vertical", 3)).toEqual([8, 120, 232]);
});

function readLinePositions(axis, count) {
  return Array.from({ length: count }, (_, index) => Number(
    screen.getByTestId(`editor-grid-line-${axis}-${index}`)
      .getAttribute("data-line-position")
  ));
}
