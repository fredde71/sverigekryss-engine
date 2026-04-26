import React, { useState } from "react";
import { useLocation } from "react-router-dom";

function Play() {
  const query = new URLSearchParams(useLocation().search);
  const data = JSON.parse(decodeURIComponent(query.get("data")));

  const { cellTypes, gridArea, rows, cols, image } = data;

  const [answers, setAnswers] = useState({});

return (
  <div style={{ padding: "20px" }}>
    
    {/* CANVAS (EXAKT SOM EDIT) */}
    <div style={{ position: "relative", width: "1200px", margin: "0 auto" }}>
      
      <img
        src={image}
        alt="grid"
        style={{
          width: "1200px",
          display: "block"
        }}
      />

      <div
  style={{
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%"
  }}
>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`
          }}
        >
          {Array.from({ length: rows * cols }).map((_, i) => {
            const type = cellTypes[i];

            if (type === "image" || type === "blocked") {
              return <div key={i} />;
            }

            return (
              <input
                key={i}
                maxLength={1}
                value={answers[i] || ""}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().slice(0, 1);
                  setAnswers(prev => ({
                    ...prev,
                    [i]: val
                  }));
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  textAlign: "center",
                  fontSize: "18px",
                  fontWeight: "bold",
                  border: "none",
                  outline: "none"
                }}
              />
            );
          })}
        </div>
      </div>

    </div>

  </div>
);
}

export default Play;