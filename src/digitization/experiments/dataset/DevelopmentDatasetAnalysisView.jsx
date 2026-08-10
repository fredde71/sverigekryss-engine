import React from "react";

export default function DevelopmentDatasetAnalysisView({
  analysisSummary,
  failureReport,
  readEnvironment = () => process.env.NODE_ENV
}) {
  const environment = readEnvironment();

  if (environment !== "development" && environment !== "test") {
    return null;
  }

  if (!analysisSummary || !failureReport) {
    return (
      <p role="status">No completed dataset analysis is available.</p>
    );
  }

  if (
    analysisSummary.type !== "digitization-dataset-analysis-summary"
    || failureReport.type !== "grid-detection-failure-report"
  ) {
    return (
      <p role="status">Dataset analysis reports are unavailable.</p>
    );
  }

  const sections = analysisSummary.sections;

  return (
    <article aria-labelledby="dataset-analysis-title">
      <header>
        <h2 id="dataset-analysis-title">Digitization Lab</h2>
        <p>Development only</p>
      </header>

      <DatasetOverviewSection dataset={analysisSummary.dataset} />
      <CompletionSection completion={sections.completion} />
      <GridDetectionSection
        gridDetection={sections.gridDetection}
        outcomeItems={failureReport.production.outcomes.items}
      />
      <FailureReasonsSection
        failureReasons={sections.productionFailureReasons}
      />
      <ProductionConfidenceSection
        confidence={sections.productionConfidence}
      />
      <FrequentExperimentObservationsSection
        frequentObservations={sections.frequentExperimentObservations}
      />
      <RecurringDiagnosticPatternsSection
        recurringPatterns={sections.recurringDiagnosticPatterns}
        patterns={failureReport.recurringDiagnosticPatterns.patterns}
      />
    </article>
  );
}

function DatasetOverviewSection({ dataset }) {
  return (
    <AnalysisSection id="dataset-overview" title="Dataset overview">
      <dl>
        <DataRow label="Dataset ID" value={dataset.datasetId} />
        <DataRow label="Puzzles" value={dataset.itemCount} />
      </dl>
    </AnalysisSection>
  );
}

function CompletionSection({ completion }) {
  return (
    <AnalysisSection id="dataset-completion" title="Completion">
      <p>{completion.summary}</p>
      <dl>
        <DataRow label="Total" value={completion.totalCount} />
        <DataRow label="Completed" value={completion.completedCount} />
        <DataRow label="Incomplete" value={completion.incompleteCount} />
      </dl>
    </AnalysisSection>
  );
}

function GridDetectionSection({
  gridDetection,
  outcomeItems
}) {
  return (
    <AnalysisSection id="dataset-grid-detection" title="Grid detection">
      <p>{gridDetection.summary}</p>
      <dl>
        <DataRow label="Detected" value={gridDetection.detectedCount} />
        <DataRow label="Not detected" value={gridDetection.notDetectedCount} />
        <DataRow label="Production failed" value={gridDetection.productionFailedCount} />
        <DataRow label="Production not run" value={gridDetection.productionNotRunCount} />
        <DataRow label="Unavailable" value={gridDetection.unavailableCount} />
      </dl>
      {outcomeItems.length > 0 && (
        <ol aria-label="Production outcomes">
          {outcomeItems.map((item, index) => (
            <li key={`${item.id}-${index}`}>
              <span>{item.metadata?.filename ?? item.id}</span>
              {" — "}
              <span>{item.outcome}</span>
              {item.productionStatus !== undefined && (
                <span>{` (production: ${item.productionStatus})`}</span>
              )}
              {item.confidence?.status !== undefined && (
                <span>
                  {` (confidence: ${item.confidence.status}`}
                  {item.confidence.status === "available"
                    ? `, ${formatValue(item.confidence.value)}`
                    : ""}
                  {`)`}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </AnalysisSection>
  );
}

function FailureReasonsSection({ failureReasons }) {
  return (
    <AnalysisSection id="dataset-failure-reasons" title="Production failure reasons">
      <p>{failureReasons.summary}</p>
      {failureReasons.reasons.length > 0 && (
        <ol aria-label="Production failure reasons">
          {failureReasons.reasons.map((entry, index) => (
            <li key={`${entry.id}-${index}`}>
              <p>{entry.label}</p>
              <p>{`${entry.itemCount} affected item(s)`}</p>
              <code>{formatValue(entry.reason)}</code>
              <OrderedItemIds itemIds={entry.itemIds} label="Affected item IDs" />
            </li>
          ))}
        </ol>
      )}
    </AnalysisSection>
  );
}

function ProductionConfidenceSection({ confidence }) {
  return (
    <AnalysisSection id="dataset-production-confidence" title="Production confidence">
      <p>{confidence.summary}</p>
      <dl>
        <DataRow label="Available" value={confidence.availableItemCount} />
        <DataRow label="Unavailable" value={confidence.unavailableItemCount} />
      </dl>
      {confidence.values.length > 0 && (
        <ol aria-label="Production confidence values">
          {confidence.values.map((entry, index) => (
            <li key={`${entry.label}-${index}`}>
              <code>{entry.label}</code>
              <span>{` — ${entry.itemCount} item(s)`}</span>
              <OrderedItemIds itemIds={entry.itemIds} label="Confidence item IDs" />
            </li>
          ))}
        </ol>
      )}
      {confidence.unavailableItemIds.length > 0 && (
        <OrderedItemIds
          itemIds={confidence.unavailableItemIds}
          label="Unavailable confidence item IDs"
        />
      )}
    </AnalysisSection>
  );
}

function FrequentExperimentObservationsSection({ frequentObservations }) {
  return (
    <AnalysisSection
      id="dataset-frequent-observations"
      title="Frequent experiment observations"
    >
      <p>{frequentObservations.summary}</p>
      {frequentObservations.observations.length > 0 && (
        <ol aria-label="Frequent experiment observations">
          {frequentObservations.observations.map((observation, index) => (
            <li key={`${observation.experimentId}-${observation.observationId}-${index}`}>
              <dl>
                <DataRow label="Experiment" value={observation.experimentId} />
                <DataRow label="Category" value={observation.category} />
                <DataRow label="Observation" value={observation.observationId} />
                <DataRow label="Value" value={formatValue(observation.value)} />
                <DataRow label="Item count" value={observation.itemCount} />
              </dl>
              <OrderedItemIds itemIds={observation.itemIds} label="Observation item IDs" />
            </li>
          ))}
        </ol>
      )}
    </AnalysisSection>
  );
}

function RecurringDiagnosticPatternsSection({
  recurringPatterns,
  patterns
}) {
  return (
    <AnalysisSection
      id="dataset-recurring-patterns"
      title="Recurring diagnostic patterns"
    >
      <p>{recurringPatterns.summary}</p>
      {patterns.length > 0 && (
        <ol aria-label="Recurring diagnostic patterns">
          {patterns.map((pattern, index) => (
            <li key={`${pattern.id}-${index}`}>
              <dl>
                <DataRow label="Diagnostic type" value={pattern.diagnosticType} />
                <DataRow label="Observation" value={formatValue(pattern.observation)} />
                <DataRow label="Item count" value={pattern.itemCount} />
              </dl>
              <OrderedItemIds itemIds={pattern.itemIds} label="Pattern item IDs" />
            </li>
          ))}
        </ol>
      )}
    </AnalysisSection>
  );
}

function AnalysisSection({ id, title, children }) {
  const titleId = `${id}-title`;

  return (
    <section aria-labelledby={titleId} data-analysis-section={id}>
      <h3 id={titleId}>{title}</h3>
      {children}
    </section>
  );
}

function DataRow({ label, value }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{String(value)}</dd>
    </>
  );
}

function OrderedItemIds({ itemIds, label }) {
  return (
    <ol aria-label={label}>
      {itemIds.map((itemId, index) => (
        <li key={`${itemId}-${index}`}>{itemId}</li>
      ))}
    </ol>
  );
}

function formatValue(value) {
  const serialized = JSON.stringify(sortObjectKeys(value));

  return serialized === undefined ? String(value) : serialized;
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, sortObjectKeys(value[key])])
    );
  }

  return value;
}
