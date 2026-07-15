import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import RuntimeLayer from "./runtime/RuntimeLayer";
import TemplateCanvas from "./template/TemplateCanvas";
import { loadBackendTemplate } from "./template/templateApi";

function Play() {
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setData(null);

    loadBackendTemplate(id)
      .then(template => {
        setData(template);
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
    <TemplateCanvas template={data} responsive>
      <RuntimeLayer data={data} />
    </TemplateCanvas>
  );
}

export default Play;
