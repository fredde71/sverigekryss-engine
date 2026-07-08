import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import RuntimeLayer from "./runtime/RuntimeLayer";
import TemplateCanvas from "./template/TemplateCanvas";
import { normalizeTemplate } from "./template/templateModel";

function Play() {
  const { id } = useParams();

  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5050/api/crossword/${id}`)
      .then(res => res.json())
      .then(template => {
        if (template.success === false) {
          setData(template);
          return;
        }

        setData(normalizeTemplate(template, {
          crosswordId: id,
          rows: 25,
          cols: 25,
          gridArea: {
            top: 0,
            left: 0,
            width: 1200,
            height: 1200
          },
          imageSrc: ""
        }));
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
    <TemplateCanvas template={data}>
      <RuntimeLayer data={data} />
    </TemplateCanvas>
  );
}

export default Play;
