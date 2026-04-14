import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Play from "./Play";

const root = ReactDOM.createRoot(document.getElementById("root"));

const path = window.location.pathname;

if (path.startsWith("/play")) {
  root.render(<Play />);
} else {
  root.render(<App />);
}