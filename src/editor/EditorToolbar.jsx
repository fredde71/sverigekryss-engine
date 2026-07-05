import React from "react";

export default function EditorToolbar({
  pendingRows,
  setPendingRows,
  pendingCols,
  setPendingCols,
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
        <button onClick={() => setActiveTool("image")}>Image</button><br /><br />
        <button onClick={() => setActiveTool("blocked")}>Blocked</button><br /><br />
        <button onClick={() => setActiveTool("double")}>Double clue</button><br /><br />
        <button onClick={() => setActiveTool("write")}>Write</button><br /><br />
        <button onClick={() => setActiveTool("empty")}>Empty</button><br /><br />
    </>
  );
}
