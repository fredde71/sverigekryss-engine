import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PlaySurface from "./play/PlaySurface";
import { loadBackendTemplate } from "./template/templateApi";
import { loadBackendPublication } from "./publication/publicationApi";

function Play() {
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [publicationId, setPublicationId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setData(null);
    setPublicationId("");

    loadPlayableTemplate(id)
      .then(result => {
        setData(result.template);
        setPublicationId(result.publicationId || "");
      })
      .catch(err => {
        setError(err.message || "Failed to load template.");
      });
  }, [id]);

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
      responsive
      onSubmitAnswers={() => {}}
    />
  );
}

async function loadPlayableTemplate(id) {
  try {
    const publication = await loadBackendPublication(id);
    const template = await loadBackendTemplate(publication.crosswordId);

    return {
      template,
      publicationId: publication.publicationId
    };
  } catch (err) {
    if (err.status === 404) {
      return {
        template: await loadBackendTemplate(id),
        publicationId: ""
      };
    }

    throw err;
  }
}

export default Play;
