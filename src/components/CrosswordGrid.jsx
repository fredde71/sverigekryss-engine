import React, { useState } from "react";

const GRID_SIZE = 25;

export default function CrosswordGrid({ imageUrl }) {
  const [selectedCells, setSelectedCells] = useState(new Set());

  const [config, setConfig] = useState({
    offsetX: 0,
    offsetY: 0,
    width: 600,
    height: 600,
  });

  const toggleCell = (row, col) => {
    const key = `${row}-${col}`;
    const newSet = new Set(selectedCells);

    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);

    setSelectedCells(newSet);
  };

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setConfig({ ...config, offsetX: config.offsetX - 1 })}>←</button>
        <button onClick={() => setConfig({ ...config, offsetX: config.offsetX + 1 })}>→</button>
        <button onClick={() => setConfig({ ...config, offsetY: config.offsetY - 1 })}>↑</button>
        <button onClick={() => setConfig({ ...config, offsetY: config.offsetY + 1 })}>↓</button>
        <button onClick={() => setConfig({ ...config, width: config.width + 10 })}>+W</button>
        <button onClick={() => setConfig({ ...config, width: config.width - 10 })}>-W</button>
        <button onClick={() => setConfig({ ...config, height: config.height + 10 })}>+H</button>
        <button onClick={() => setConfig({ ...config, height: config.height - 10 })}>-H</button>
      </div>

      <div style={{ position: "relative", display: "inline-block" }}>
        <img
          src={imageUrl}
          alt="crossword"
          style={{ display: "block", width: config.width, height: config.height }}
        />

        <div
          style={{
            position: "absolute",
            top: config.offsetY,
            left: config.offsetX,
            width: config.width,
            height: config.height,
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
            const row = Math.floor(index / GRID_SIZE);
            const col = index % GRID_SIZE;
            const key = `${row}-${col}`;
            const isSelected = selectedCells.has(key);

            return (
              <div
                key={key}
                onClick={() => toggleCell(row, col)}
                style={{
                  border: "1px solid rgba(0,0,0,0.2)",
                  backgroundColor: isSelected
                    ? "rgba(255,0,0,0.4)"
                    : "transparent",
                  cursor: "pointer",
                }}
              />
            );
          })}
        </div>
      </div>

      <pre style={{ marginTop: 10 }}>
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  );
}
