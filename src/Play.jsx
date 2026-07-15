import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import RuntimeLayer from "./runtime/RuntimeLayer";
import TemplateCanvas from "./template/TemplateCanvas";
import { loadBackendTemplate } from "./template/templateApi";

function Play() {
  const { id } = useParams();

  const [data, setData] = useState(null);

  useEffect(() => {
    loadBackendTemplate(id)
      .then(template => {
        setData(template);
      });
  }, [id]);

  console.log("Play rendered", data);

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
