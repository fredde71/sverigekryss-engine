import React from "react";
import { render, screen } from "@testing-library/react";
import RuntimeGrid from "./RuntimeGrid";

test("renders runtime cells from persisted explicit line positions", () => {
  render(
    <RuntimeGrid
      rows={2}
      cols={2}
      gridArea={{ top: 10, left: 20, width: 100, height: 80 }}
      horizontalLinePositions={[10, 42, 90]}
      verticalLinePositions={[20, 57, 120]}
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} data-testid={`runtime-cell-${index}`} />
      ))}
    </RuntimeGrid>
  );

  expect(screen.getByTestId("runtime-grid-explicit")).toBeInTheDocument();
  expect(screen.getByTestId("runtime-cell-0")).toHaveStyle({
    top: "0px",
    left: "0px",
    width: "37px",
    height: "32px"
  });
  expect(screen.getByTestId("runtime-cell-3")).toHaveStyle({
    top: "32px",
    left: "37px",
    width: "63px",
    height: "48px"
  });
});

test("legacy runtime grids retain uniform CSS-grid rendering", () => {
  render(
    <RuntimeGrid rows={2} cols={3}>
      {Array.from({ length: 6 }, (_, index) => <div key={index} />)}
    </RuntimeGrid>
  );

  expect(screen.getByTestId("runtime-grid-uniform")).toHaveStyle({
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gridTemplateRows: "repeat(2, 1fr)"
  });
  expect(screen.queryByTestId("runtime-grid-explicit")).not.toBeInTheDocument();
});
