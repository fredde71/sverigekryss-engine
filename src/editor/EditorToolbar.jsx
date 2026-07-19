import React from "react";

export default function EditorToolbar({
  pendingRows,
  setPendingRows,
  pendingCols,
  setPendingCols,
  activeTool,
  setActiveTool,
  createGrid
}) {
  return (
    <>
      <div style={{ marginBottom: "10px" }}>

  <div>Rows</div>

  <input
    type="number"
    value={pendingRows}
    onChange={(e) => setPendingRows(Number(e.target.value))}
    style={{ width: "80px" }}
  />

  <div style={{ marginTop: "10px" }}>Cols</div>

  <input
    type="number"
    value={pendingCols}
    onChange={(e) => setPendingCols(Number(e.target.value))}
    style={{ width: "80px" }}
  />

  <br /><br />

<button onClick={createGrid}>
  Create Grid
</button>

</div>
        <button aria-pressed={activeTool === "image"} onClick={() => setActiveTool("image")}>Image</button><br /><br />
        <button aria-pressed={activeTool === "blocked"} onClick={() => setActiveTool("blocked")}>Blocked</button><br /><br />
        <button aria-pressed={activeTool === "double"} onClick={() => setActiveTool("double")}>Double clue</button><br /><br />
        <button aria-pressed={activeTool === "write"} onClick={() => setActiveTool("write")}>Write</button><br /><br />
        <button aria-pressed={activeTool === "competition"} onClick={() => setActiveTool("competition")}>🏆 Tävlingsruta</button><br /><br />
        <button aria-pressed={activeTool === "empty"} onClick={() => setActiveTool("empty")}>Empty</button><br /><br />
    </>
  );
}
