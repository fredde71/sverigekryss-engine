# Digitization Lab Rules

## Purpose

This document is the canonical working guidance for Digitization Lab development.

It supplements, and does not replace:

- `DEVELOPMENT_RULES.md`
- `SYSTEM_OVERVIEW.md`
- `DOMAIN_MODEL.md`

The lab exists to collect reproducible evidence about digitization behavior before production behavior is changed. It supports investigation, comparison, reconstruction, and validation of existing crossword material. It does not own production detection, editor state, templates, persistence, or user-facing product behavior.

These are default architectural principles, not rigid rules that may block progress. A deviation is allowed when evidence justifies it, but the deviation, evidence, scope, and expected effect must be explicit and documented.

## Core Boundary

Production owns the production result. The lab may observe an existing production result, but must not recreate, replace, mutate, or silently reinterpret it.

Development-only observations must remain separate from:

- production `GridDetection`
- production confidence and suggestions
- grid area, rows, columns, crop area, and editor state
- backend, persistence, and published template data

Shadow or experimental output must never enter production assembly through fallback, automatic selection, or shared mutable state.

## Artifact Roles

### Observation

A deterministic, read-only statement of measured evidence. It preserves provenance, coordinate systems, availability, ambiguity, and reasons. It does not prescribe behavior.

### Shadow experiment

A development/test-only execution of an isolated hypothesis or existing domain contract. It must be registered explicitly, preserve deterministic order, isolate failures, and expose diagnostics without changing production.

### Reconstruction

A domain operation that derives explicit compatible structures from supplied evidence and parameters. Raw candidates remain separate from inferred lines. Multiple compatible variants remain visible unless a separate, evidence-backed decision boundary is introduced.

### Ground Truth

A deterministic, human-confirmed reference artifact associated with exact dataset items and coordinates. Ground Truth is validation-only.

Ground Truth must never:

- be runtime input to detection, observation, reconstruction, or production
- influence experiment parameters or hypothesis generation
- remove, reorder, select, or improve experimental results
- be treated as publisher knowledge available during normal digitization

### Validation

A pure post-dataset comparison between preserved observations and Ground Truth. Validation may report exact matches, deltas, missing or extra evidence, and unavailable states. It must not rerun the pipeline or feed conclusions back into the observed artifact.

## Ownership and Dependencies

- Document Analysis owns document and BinaryImage preparation and coordinate relationships.
- Analysis Region owns the declared image domain for downstream analysis.
- Grid Analysis owns region-scoped projections, candidates, and observed geometry.
- Bounds observation owns evidence about possible outer-grid bounds; candidate envelopes are not automatically confirmed grid bounds.
- Reconstruction owns explicit hypotheses derived from candidates, bounds evidence, spacing evidence, and parameters.
- Experiments own development-only observation of hypotheses.
- Dataset orchestration owns deterministic execution and result collection, not interpretation.
- Reports own pure projections over completed artifacts.
- Ground Truth annotation owns human confirmation.
- Validation owns comparison only.
- Production orchestration alone owns production sequencing, compatibility policy, public result assembly, suggestions, and confidence.

Dependencies should point from lower-level evidence toward observation and validation. Validation results must not flow backward into experiments, reconstruction, Grid Analysis, or production.

## Evidence-First Development

1. Establish the current failure or uncertainty with reproducible diagnostics.
2. Preserve raw evidence and provenance before deriving summaries.
3. Observe behavior before changing behavior.
4. Diagnose rejection paths before changing tolerances or parameters.
5. Prefer the smallest isolated experiment capable of verifying or falsifying one hypothesis.
6. Use real datasets to repeat observations, while keeping synthetic tests for exact contracts and edge cases.
7. Separate factual observations from architectural decisions and production adoption.

Do not infer missing evidence, publisher expectations, coordinate equivalence, or algorithm correctness. Represent missing evidence as unavailable and conflicting evidence as ambiguous where appropriate.

## Evaluation Discipline

Ranking, selection, confidence, scores, recommendations, winners, preferred variants, and automatic acceptance are absent by default.

They may be introduced only when:

- their meaning and owner are explicit
- evidence demonstrates a real need
- inputs and normalization are defined
- uncertainty and unavailable evidence are preserved
- focused tests protect against accidental production influence

Do not tune tolerances, thresholds, or limits before diagnostics explain which rule rejects the observed evidence. Parameter changes must be separate from diagnostic changes so their behavioral effect remains measurable.

## Implementation Rules

- Make one small, reviewable architectural change at a time.
- Reuse existing contracts, projections, diagnostics, registries, runners, and exporters where ownership matches.
- Keep experiments deterministic and immutable where their contracts require it.
- Preserve input, provider, region, axis, candidate, variant, and dataset order.
- Isolate failures at the narrowest useful boundary.
- Keep runtime image data out of compact reports and exports.
- State coordinate systems and transforms explicitly.
- Preserve raw observations separately from normalized comparisons and derived diagnostics.
- Do not add UI or persistence unless that integration is the explicit task.
- Verify focused tests, the full suite, the production build, and `git diff --check` in proportion to the change.

## Default Development Flow

```text
Contract
  ↓
Shadow plumbing
  ↓
Observation / experiment
  ↓
Ground Truth validation
  ↓
Architectural review
  ↓
Algorithm / behavioral change
  ↓
Production adoption
```

Each stage should remain useful without assuming the next stage will happen. Skipping a stage is acceptable only when the reason and supporting evidence are explicit.

Production adoption is a separate decision and implementation step. Experimental success alone does not authorize it.

## Pre-Flight Questions

Before Digitization Lab work begins, answer briefly:

1. What single uncertainty or hypothesis is being investigated?
2. Which artifact owns the new evidence?
3. Which existing inputs are allowed, and which dependencies are forbidden?
4. How are production and Ground Truth prevented from influencing the observation?
5. What unavailable or ambiguous states must be preserved?
6. What focused tests can verify the contract without claiming real-world accuracy?
7. What evidence would justify the next architectural step?
