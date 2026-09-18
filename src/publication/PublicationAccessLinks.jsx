import React from "react";
import { createTemplateSolutionIndex } from "../template/templateSolutions";
import { createPublicationAccessLinks } from "./publicationAccess";

export default function PublicationAccessLinks({
  publication,
  onPublishHelp
}) {
  if (!publication) return null;

  const viewModel = createPublicationAccessLinkViewModel(publication);

  return (
    <section aria-label="Publiceringslänkar">
      <CopyablePublicationLink label="Lösarlänk" url={viewModel.solveUrl} />
      {viewModel.helpUrl ? (
        <CopyablePublicationLink
          label="Facit-/hjälplänk"
          url={viewModel.helpUrl}
        />
      ) : (
        <>
          <p role="status">{viewModel.helpUnavailableReason}</p>
          <button
            type="button"
            disabled={!viewModel.canPublishHelp}
            onClick={onPublishHelp}
          >
            Publicera facit
          </button>
        </>
      )}
    </section>
  );
}

export function createPublicationAccessLinkViewModel(publication) {
  const links = createPublicationAccessLinks(publication);
  const solutionIndex = createTemplateSolutionIndex(
    publication?.crosswordSnapshot?.template
  );

  return Object.freeze({
    ...links,
    canPublishHelp: Boolean(
      publication?.helpAccessToken
      && publication?.helpAccessStatus !== "active"
      && solutionIndex.completenessStatus === "complete"
    ),
    helpUnavailableReason: links.helpUrl
      ? ""
      : getHelpUnavailableReason(solutionIndex)
  });
}

function CopyablePublicationLink({ label, url }) {
  const copy = async () => {
    await navigator.clipboard?.writeText(url);
  };

  return (
    <div>
      <label>
        {label}
        <input aria-label={label} readOnly value={url} />
      </label>
      <button type="button" onClick={copy}>
        Kopiera {label.toLowerCase()}
      </button>
    </div>
  );
}

function getHelpUnavailableReason(solutionIndex) {
  if (solutionIndex.completenessStatus === "inconsistent") {
    return "Facit-/hjälplänk saknas eftersom korsande lösningar har bokstavskonflikter.";
  }
  if (solutionIndex.missingAnswerPathCount > 0) {
    return "Facit-/hjälplänk saknas eftersom alla svar inte har en sparad svarsväg.";
  }
  if (solutionIndex.completenessStatus === "complete") {
    return "Facit är komplett men ännu inte publicerat.";
  }
  return "Facit-/hjälplänk saknas eftersom alla svar inte har en komplett giltig lösning.";
}
