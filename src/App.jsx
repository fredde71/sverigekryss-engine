import React from "react";
import CrosswordGrid from "./components/CrosswordGrid";

function App() {
  const imageUrl = "http://localhost:8000/crossword-image";

  return (
    <div style={{ padding: 20 }}>
      <h1>Sverigekrysset</h1>
      <CrosswordGrid imageUrl={imageUrl} />
    </div>
  );
}

export default App;
