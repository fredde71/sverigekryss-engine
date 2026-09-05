import React from "react";
import DigitizationDatasetHarness from "./dataset/DigitizationDatasetHarness";

export default function DigitizationLabPage() {
  if (!["development", "test"].includes(process.env.NODE_ENV)) {
    return null;
  }

  return (
    <main aria-label="Digitization Lab" style={{ padding: "20px" }}>
      <h1>Digitization Lab</h1>
      <DigitizationDatasetHarness />
    </main>
  );
}
