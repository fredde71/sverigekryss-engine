import React from "react";
import { render, screen, within } from "@testing-library/react";
import DevelopmentDatasetAnalysisView from "./DevelopmentDatasetAnalysisView";

test.each(["development", "test"])(
  "renders the development-only view in %s",
  environment => {
    renderView({ environment });

    expect(screen.getByRole("heading", { name: "Digitization Lab" })).toBeInTheDocument();
    expect(screen.getByText("Development only")).toBeInTheDocument();
  }
);

test.each(["production", undefined, "staging", "unknown"])(
  "renders nothing in the %s environment",
  environment => {
    const { container } = renderView({ environment });

    expect(container).toBeEmptyDOMElement();
  }
);

test.each([
  { analysisSummary: null },
  { failureReport: null }
])("shows the missing-report state", overrides => {
  renderView(overrides);

  expect(screen.getByRole("status")).toHaveTextContent(
    "No completed dataset analysis is available."
  );
});

test.each([
  { analysisSummary: { type: "other" } },
  { failureReport: { type: "other" } }
])("handles unsupported report types safely", overrides => {
  renderView(overrides);

  expect(screen.getByRole("status")).toHaveTextContent(
    "Dataset analysis reports are unavailable."
  );
});

test("renders sections in the approved order with accessible headings", () => {
  const { container } = renderView();
  const sections = Array.from(
    container.querySelectorAll("[data-analysis-section]")
  );

  expect(sections.map(section => section.dataset.analysisSection)).toEqual([
    "dataset-overview",
    "dataset-completion",
    "dataset-grid-detection",
    "dataset-failure-reasons",
    "dataset-production-confidence",
    "dataset-frequent-observations",
    "dataset-recurring-patterns"
  ]);
  expect(screen.getByRole("heading", { name: "Dataset overview" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Completion" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Grid detection" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Production failure reasons" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Production confidence" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Frequent experiment observations" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Recurring diagnostic patterns" })).toBeInTheDocument();
});

test("renders dataset identity, completion text and supplied counts verbatim", () => {
  const analysisSummary = createAnalysisSummary();
  analysisSummary.dataset = { datasetId: "TT local set", itemCount: 17 };
  analysisSummary.sections.completion = {
    summary: "Supplied completion sentence.",
    totalCount: 31,
    completedCount: 7,
    incompleteCount: 24
  };

  renderView({ analysisSummary });

  const overview = getSection("Dataset overview");
  const completion = getSection("Completion");

  expect(overview).toHaveTextContent("Dataset ID");
  expect(overview).toHaveTextContent("TT local set");
  expect(overview).toHaveTextContent("Puzzles");
  expect(overview).toHaveTextContent("17");
  expect(completion).toHaveTextContent("Supplied completion sentence.");
  expect(completion).toHaveTextContent("Total31");
  expect(completion).toHaveTextContent("Completed7");
  expect(completion).toHaveTextContent("Incomplete24");
});

test("renders every supplied grid-detection outcome count without recalculation", () => {
  const analysisSummary = createAnalysisSummary();
  analysisSummary.sections.gridDetection = {
    summary: "Recorded grid outcome sentence.",
    detectedCount: 91,
    notDetectedCount: 82,
    productionFailedCount: 73,
    productionNotRunCount: 64,
    unavailableCount: 55
  };

  renderView({ analysisSummary });
  const section = getSection("Grid detection");

  expect(section).toHaveTextContent("Recorded grid outcome sentence.");
  expect(section).toHaveTextContent("Detected91");
  expect(section).toHaveTextContent("Not detected82");
  expect(section).toHaveTextContent("Production failed73");
  expect(section).toHaveTextContent("Production not run64");
  expect(section).toHaveTextContent("Unavailable55");
});

test("preserves ordered production outcomes from the failure report", () => {
  const failureReport = createFailureReport();
  failureReport.production.outcomes.items = [
    {
      id: "z-item",
      metadata: { filename: "z-last.pdf" },
      outcome: "not-detected",
      productionStatus: "completed",
      confidence: { status: "available", value: "missing-grid-geometry" }
    },
    {
      id: "a-item",
      metadata: { filename: "a-first.pdf" },
      outcome: "detected",
      productionStatus: "completed",
      confidence: { status: "unavailable", value: null }
    }
  ];

  renderView({ failureReport });
  const list = screen.getByRole("list", { name: "Production outcomes" });
  const items = within(list).getAllByRole("listitem");

  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent(
    "z-last.pdf — not-detected (production: completed) (confidence: available, \"missing-grid-geometry\")"
  );
  expect(items[1]).toHaveTextContent(
    "a-first.pdf — detected (production: completed) (confidence: unavailable)"
  );
});

test("renders failure reasons in supplied order with labels and item IDs", () => {
  const analysisSummary = createAnalysisSummary();
  analysisSummary.sections.productionFailureReasons = {
    summary: "Two recorded reasons.",
    affectedItemCount: 2,
    reasons: [
      {
        id: "reason-z",
        label: "reason z",
        reason: { code: "z", axis: "vertical" },
        itemCount: 2,
        itemIds: ["item-2", "item-1"]
      },
      {
        id: "reason-a",
        label: "reason a",
        reason: { code: "a" },
        itemCount: 1,
        itemIds: ["item-3"]
      }
    ]
  };

  renderView({ analysisSummary });
  const reasonList = screen.getByRole("list", { name: "Production failure reasons" });
  const reasons = directListItems(reasonList);

  expect(reasons[0]).toHaveTextContent("reason z");
  expect(reasons[0]).toHaveTextContent("2 affected item(s)");
  expect(reasons[0]).toHaveTextContent("item-2");
  expect(reasons[0]).toHaveTextContent("item-1");
  expect(reasons[1]).toHaveTextContent("reason a");
});

test("renders confidence labels, counts, ordered IDs and unavailable evidence", () => {
  const analysisSummary = createAnalysisSummary();
  analysisSummary.sections.productionConfidence = {
    summary: "Recorded confidence sentence.",
    availableItemCount: 2,
    unavailableItemCount: 1,
    values: [
      {
        label: "\"z-confidence\"",
        value: "z-confidence",
        itemCount: 2,
        itemIds: ["item-2", "item-1"]
      },
      {
        label: "0.5",
        value: 0.5,
        itemCount: 1,
        itemIds: ["item-3"]
      }
    ],
    unavailableItemIds: ["item-4"]
  };

  renderView({ analysisSummary });
  const section = getSection("Production confidence");
  const values = screen.getByRole("list", { name: "Production confidence values" });

  expect(section).toHaveTextContent("Recorded confidence sentence.");
  expect(section).toHaveTextContent("Available2");
  expect(section).toHaveTextContent("Unavailable1");
  expect(values).toHaveTextContent('"z-confidence"');
  expect(values).toHaveTextContent("item-2");
  expect(values).toHaveTextContent("item-1");
  expect(values).toHaveTextContent("0.5");
  expect(
    screen.getByRole("list", { name: "Unavailable confidence item IDs" })
  ).toHaveTextContent("item-4");
});

test("renders every frequent-observation tie in supplied order", () => {
  const analysisSummary = createAnalysisSummary();
  analysisSummary.sections.frequentExperimentObservations = {
    summary: "Two tied observations.",
    maximumItemCount: 7,
    observations: [
      createObservation("experiment-z", "raw-z", { z: 2, a: 1 }),
      createObservation("experiment-a", "raw-a", 4)
    ]
  };

  renderView({ analysisSummary });
  const list = screen.getByRole("list", {
    name: "Frequent experiment observations"
  });
  const items = directListItems(list);

  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent("Experimentexperiment-z");
  expect(items[0]).toHaveTextContent("Observationraw-z");
  expect(items[0]).toHaveTextContent('Value{"a":1,"z":2}');
  expect(items[1]).toHaveTextContent("Experimentexperiment-a");
  expect(items[1]).toHaveTextContent("Observationraw-a");
});

test("preserves recurring diagnostic pattern order from the failure report", () => {
  const analysisSummary = createAnalysisSummary();
  analysisSummary.sections.recurringDiagnosticPatterns.summary = "Two patterns supplied.";
  const failureReport = createFailureReport();
  failureReport.recurringDiagnosticPatterns.patterns = [
    createPattern("pattern-z", "spacing-consistency", { z: 2, a: 1 }),
    createPattern("pattern-a", "acceptance-status", { accepted: false })
  ];

  renderView({ analysisSummary, failureReport });
  const list = screen.getByRole("list", { name: "Recurring diagnostic patterns" });
  const items = directListItems(list);

  expect(getSection("Recurring diagnostic patterns")).toHaveTextContent(
    "Two patterns supplied."
  );
  expect(items[0]).toHaveTextContent("Diagnostic typespacing-consistency");
  expect(items[0]).toHaveTextContent('Observation{"a":1,"z":2}');
  expect(items[1]).toHaveTextContent("Diagnostic typeacceptance-status");
});

test("renders supplied empty-state sentences without inventing lists", () => {
  renderView();

  expect(screen.getByText("No production failure reasons were recorded.")).toBeInTheDocument();
  expect(screen.getByText("No available experiment observations were recorded.")).toBeInTheDocument();
  expect(screen.getByText("No recurring production diagnostic patterns were recorded.")).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Production failure reasons" })).not.toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Frequent experiment observations" })).not.toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Recurring diagnostic patterns" })).not.toBeInTheDocument();
});

test("does not reconcile inconsistent supplied counts or details", () => {
  const analysisSummary = createAnalysisSummary();
  analysisSummary.dataset.itemCount = 99;
  analysisSummary.sections.gridDetection.detectedCount = 81;
  const failureReport = createFailureReport();
  failureReport.production.outcomes.items = [{
    id: "only-detail",
    outcome: "production-failed"
  }];

  renderView({ analysisSummary, failureReport });

  expect(getSection("Dataset overview")).toHaveTextContent("Puzzles99");
  expect(getSection("Grid detection")).toHaveTextContent("Detected81");
  expect(screen.getByRole("list", { name: "Production outcomes" })).toHaveTextContent(
    "only-detail — production-failed"
  );
});

test("does not access runtime, production or pipeline fields", () => {
  const analysisSummary = createAnalysisSummary();
  const failureReport = createFailureReport();

  for (const target of [analysisSummary, failureReport]) {
    for (const field of [
      "productionResult",
      "context",
      "imageData",
      "binaryImage",
      "projections",
      "canvas",
      "suggestions"
    ]) {
      Object.defineProperty(target, field, {
        enumerable: true,
        get() {
          throw new Error(`${field} must not be accessed`);
        }
      });
    }
  }

  expect(() => renderView({ analysisSummary, failureReport })).not.toThrow();
});

test("renders deeply frozen reports without mutation", () => {
  const analysisSummary = deepFreeze(createAnalysisSummary());
  const failureReport = deepFreeze(createFailureReport());
  const summarySnapshot = JSON.stringify(analysisSummary);
  const failureSnapshot = JSON.stringify(failureReport);

  renderView({ analysisSummary, failureReport });

  expect(JSON.stringify(analysisSummary)).toBe(summarySnapshot);
  expect(JSON.stringify(failureReport)).toBe(failureSnapshot);
});

test("introduces no evaluation, persistence, network or logging behavior", () => {
  const localStorageSpy = jest.spyOn(Storage.prototype, "setItem");
  const sessionStorageSpy = jest.spyOn(window.sessionStorage, "setItem");
  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({});
  const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

  try {
    const { container } = renderView();
    const text = container.textContent;

    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(text).not.toMatch(/ranking|winner|best|recommendation|selected experiment|score/i);
  } finally {
    localStorageSpy.mockRestore();
    sessionStorageSpy.mockRestore();
    fetchSpy.mockRestore();
    consoleSpy.mockRestore();
  }
});

function renderView(options = {}) {
  const analysisSummary = Object.prototype.hasOwnProperty.call(
    options,
    "analysisSummary"
  )
    ? options.analysisSummary
    : createAnalysisSummary();
  const failureReport = Object.prototype.hasOwnProperty.call(
    options,
    "failureReport"
  )
    ? options.failureReport
    : createFailureReport();
  const environment = Object.prototype.hasOwnProperty.call(options, "environment")
    ? options.environment
    : "test";

  return render(
    <DevelopmentDatasetAnalysisView
      analysisSummary={analysisSummary}
      failureReport={failureReport}
      readEnvironment={() => environment}
    />
  );
}

function getSection(name) {
  return screen.getByRole("heading", { name }).closest("section");
}

function directListItems(list) {
  return Array.from(list.children).filter(child => child.tagName === "LI");
}

function createAnalysisSummary() {
  return {
    type: "digitization-dataset-analysis-summary",
    version: 1,
    dataset: {
      datasetId: "local-pdfs",
      itemCount: 2
    },
    sections: {
      completion: {
        summary: "2 of 2 puzzles completed.",
        totalCount: 2,
        completedCount: 2,
        incompleteCount: 0
      },
      gridDetection: {
        summary: "2 of 2 production grids were detected.",
        detectedCount: 2,
        notDetectedCount: 0,
        productionFailedCount: 0,
        productionNotRunCount: 0,
        unavailableCount: 0
      },
      productionFailureReasons: {
        summary: "No production failure reasons were recorded.",
        affectedItemCount: 0,
        reasons: []
      },
      productionConfidence: {
        summary: "No production confidence values were recorded.",
        availableItemCount: 0,
        unavailableItemCount: 2,
        values: [],
        unavailableItemIds: []
      },
      frequentExperimentObservations: {
        summary: "No available experiment observations were recorded.",
        maximumItemCount: null,
        observations: []
      },
      recurringDiagnosticPatterns: {
        summary: "No recurring production diagnostic patterns were recorded.",
        patterns: []
      }
    }
  };
}

function createFailureReport() {
  return {
    type: "grid-detection-failure-report",
    version: 1,
    dataset: {
      datasetId: "local-pdfs",
      itemCount: 2
    },
    production: {
      outcomes: {
        detectedCount: 2,
        notDetectedCount: 0,
        productionFailedCount: 0,
        productionNotRunCount: 0,
        unavailableCount: 0,
        items: []
      },
      failureReasons: {
        affectedItemCount: 0,
        groups: []
      },
      confidence: {
        availableItemCount: 0,
        unavailableItemCount: 2,
        values: [],
        unavailableItemIds: []
      }
    },
    experiments: {
      itemCountWithBenchmark: 0,
      itemCountWithoutBenchmark: 2,
      experiments: []
    },
    recurringDiagnosticPatterns: {
      patterns: []
    }
  };
}

function createObservation(experimentId, observationId, value) {
  return {
    experimentId,
    category: "projection",
    observationId,
    value,
    itemCount: 7,
    itemIds: ["item-2", "item-1"]
  };
}

function createPattern(id, diagnosticType, observation) {
  return {
    id,
    diagnosticType,
    observation,
    itemCount: 2,
    itemIds: ["item-2", "item-1"]
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
