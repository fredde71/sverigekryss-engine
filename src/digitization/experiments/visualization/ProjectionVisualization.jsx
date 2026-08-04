import React from "react";

const SERIES_SHADES = Object.freeze([
  "#374151",
  "#6b7280",
  "#9ca3af",
  "#d1d5db"
]);
const MAX_BUCKET_COUNT = 250;

export default function ProjectionVisualization({ visualization }) {
  const series = Array.isArray(visualization?.data?.series)
    ? visualization.data.series
    : [];
  const sourceLength = findLongestSeriesLength(series);
  const bucketRanges = createBucketRanges(sourceLength);
  const bucketedSeries = series.map((profile) => ({
    profile,
    buckets: createBuckets(profile?.values, bucketRanges)
  }));
  const largestValue = findLargestValue(bucketedSeries);
  const visualizationTitle = visualization?.title || "Vertical Projection";

  return (
    <section aria-label={visualizationTitle}>
      <h3>{visualizationTitle}</h3>

      {bucketedSeries.map(({ profile, buckets }, seriesIndex) => {
        const values = Array.isArray(profile?.values) ? profile.values : [];
        const seriesTitle = profile?.title || profile?.id || `Series ${seriesIndex + 1}`;
        const shade = SERIES_SHADES[seriesIndex % SERIES_SHADES.length];

        return (
          <section
            key={`${profile?.id || "series"}-${seriesIndex}`}
            aria-label={seriesTitle}
            data-series-id={profile?.id || ""}
          >
            <h4>{seriesTitle}</h4>

            {values.length === 0 ? (
              <p>No projection values.</p>
            ) : (
              <div role="list" aria-label={`${seriesTitle} values`}>
                {buckets.map(({ start, end, value }) => (
                  <div
                    key={`${start}-${end}`}
                    role="listitem"
                    aria-label={`${seriesTitle} positions ${start}–${end}: ${value}`}
                    data-start-position={start}
                    data-end-position={end}
                    data-value={String(value)}
                    style={{
                      height: "8px",
                      marginBottom: "2px",
                      background: "#f3f4f6"
                    }}
                  >
                    <div
                      style={{
                        width: `${calculateBarPercentage(value, largestValue)}%`,
                        height: "100%",
                        background: shade
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}

function findLongestSeriesLength(series) {
  return series.reduce((longestLength, profile) => (
    Array.isArray(profile?.values)
      ? Math.max(longestLength, profile.values.length)
      : longestLength
  ), 0);
}

function createBucketRanges(sourceLength) {
  const bucketCount = Math.min(sourceLength, MAX_BUCKET_COUNT);

  return Array.from({ length: bucketCount }, (_, bucketIndex) => ({
    start: Math.floor((bucketIndex * sourceLength) / bucketCount),
    end: Math.floor(((bucketIndex + 1) * sourceLength) / bucketCount) - 1
  }));
}

function createBuckets(values, bucketRanges) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  return bucketRanges.map(({ start, end }) => ({
    start,
    end,
    value: Math.max(...values.slice(start, end + 1))
  }));
}

function findLargestValue(bucketedSeries) {
  let largestValue = 0;

  for (const { buckets } of bucketedSeries) {
    for (const { value } of buckets) {
      if (Number.isFinite(value)) {
        largestValue = Math.max(largestValue, value);
      }
    }
  }

  return largestValue;
}

function calculateBarPercentage(value, largestValue) {
  if (!Number.isFinite(value) || value <= 0 || largestValue <= 0) {
    return 0;
  }

  return Math.round((value / largestValue) * 10000) / 100;
}
