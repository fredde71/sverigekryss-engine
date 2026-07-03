import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import RuntimeLayer from "./runtime/RuntimeLayer";

function Play() {
  const { id } = useParams();

  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5050/api/crossword/${id}`)
      .then(res => res.json())
      .then(template => {
        setData(template);
      });
  }, [id]);

  console.log("Play rendered", data);

  return <RuntimeLayer data={data} />;
}

export default Play;