import { createGridLatticeEvidence } from "./GridLatticeEvidence";
import {
  generateGridLatticeCandidates
} from "./GridLatticeCandidateGeneration";
import {
  fuseGridLatticeCandidateEvidence
} from "./GridLatticeEvidenceFusion";
import {
  selectGridLatticeCandidate
} from "./GridLatticeCandidateSelection";
import {
  createGridLatticeReconstructionResult
} from "./GridLatticeReconstructionResult";

export function runGridLatticeReconstruction(input = {}) {
  return createGridLatticeReconstructionPipeline()(input);
}

export function createGridLatticeReconstructionPipeline({
  createEvidence = createGridLatticeEvidence,
  generateCandidates = generateGridLatticeCandidates,
  fuseEvidence = fuseGridLatticeCandidateEvidence,
  selectCandidate = selectGridLatticeCandidate,
  createReconstructionResult = createGridLatticeReconstructionResult
} = {}) {
  [
    [createEvidence, "createEvidence"],
    [generateCandidates, "generateCandidates"],
    [fuseEvidence, "fuseEvidence"],
    [selectCandidate, "selectCandidate"],
    [createReconstructionResult, "createReconstructionResult"]
  ].forEach(([dependency, name]) => {
    if (typeof dependency !== "function") {
      throw new Error(`${name} must be a function`);
    }
  });

  return function reconstructGridLattice({
    evidence,
    primitivePeriodEvidence,
    factoredBounds = null
  } = {}) {
    const normalizedEvidence = createEvidence(evidence);
    const generationInput = {
      evidence: normalizedEvidence,
      primitivePeriodEvidence
    };
    if (factoredBounds !== null) {
      generationInput.factoredBounds = factoredBounds;
    }
    const candidateGeneration = generateCandidates(generationInput);
    const evidenceFusion = fuseEvidence({
      candidateGeneration,
      evidence: normalizedEvidence,
      primitivePeriodEvidence
    });
    const candidateSelection = selectCandidate({
      candidateGeneration,
      evidenceFusion
    });

    return createReconstructionResult({
      candidateGeneration,
      evidenceFusion,
      candidateSelection
    });
  };
}
