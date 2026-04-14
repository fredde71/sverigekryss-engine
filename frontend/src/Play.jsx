import React, { useEffect, useState } from "react";

function Play() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("data");

    if (encoded) {
      const parsed = JSON.parse(decodeURIComponent(encoded));
      setData(parsed);
    }
  }, []);

  if (!data) return <div>Laddar...</div>;

  return (
    <div style={{ padding: "20px" }}>
      <h2>Korsord</h2>

      <img
        src={data.image}
        alt="grid"
        style={{ width: "1000px", display: "block" }}
      />
    </div>
  );
}

export default Play;