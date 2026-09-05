import React from "react";
import { render, screen } from "@testing-library/react";
import DigitizationLabPage from "./DigitizationLabPage";

jest.mock("./dataset/DigitizationDatasetHarness", () => function Harness() {
  return <div>Existing dataset harness</div>;
});

test("development Lab page composes the existing dataset harness", () => {
  render(<DigitizationLabPage />);

  expect(screen.getByRole("main", { name: "Digitization Lab" }))
    .toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Digitization Lab" }))
    .toBeInTheDocument();
  expect(screen.getByText("Existing dataset harness")).toBeInTheDocument();
});
