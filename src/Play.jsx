import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PlaySurface from "./play/PlaySurface";
import { loadBackendTemplate } from "./template/templateApi";
import { loadBackendPublication } from "./publication/publicationApi";
import {
  getPublicationHelpAccessToken
} from "./publication/publicationAccess";
import { normalizeTemplate } from "./template/templateModel";
import { stripTemplateSolutions } from "./template/templateSolutions";

function Play() {
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [publicationId, setPublicationId] = useState("");
  const [publicationAccess, setPublicationAccess] = useState(null);
  const [error, setError] = useState("");
  const helpAccessToken = getPublicationHelpAccessToken(window.location.search);

  useEffect(() => {
    setError("");
    setData(null);
    setPublicationId("");
    setPublicationAccess(null);

    loadPlayableTemplate(id, helpAccessToken)
      .then(result => {
        setData(result.template);
        setPublicationId(result.publicationId || "");
        setPublicationAccess(result.publicationAccess || null);
      })
      .catch(err => {
        setError(err.message || "Failed to load template.");
      });
  }, [helpAccessToken, id]);

  console.log("Play rendered", data);

  if (error) {
    return <div>Could not load template: {error}</div>;
  }

  if (!data) {
    return <div>Loading...</div>;
  }

  if (data.success === false || !data.gridArea) {
    return <div>Template not found.</div>;
  }

  return (
    <PlaySurface
      template={data}
      publicationId={publicationId}
      publicationAccess={publicationAccess}
      responsive
      onSubmitAnswers={() => {}}
    />
  );
}

async function loadPlayableTemplate(id, helpAccessToken = "") {
  try {
    const publication = await loadBackendPublication(id, { helpAccessToken });
    const template = publication.crosswordSnapshot
      ? normalizeTemplate(publication.crosswordSnapshot.template)
      : normalizeTemplate(stripTemplateSolutions(
        await loadBackendTemplate(publication.crosswordId)
      ));

    return {
      template,
      publicationId: publication.publicationId,
      publicationAccess: publication.access || null
    };
  } catch (err) {
    if (err.status === 404) {
      return {
        template: normalizeTemplate(stripTemplateSolutions(
          await loadBackendTemplate(id)
        )),
        publicationId: "",
        publicationAccess: null
      };
    }

    throw err;
  }
}

export default Play;
