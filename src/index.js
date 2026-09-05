import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import Play from "./Play";
import reportWebVitals from "./reportWebVitals";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const isDigitizationLabEnvironment = ["development", "test"].includes(
  process.env.NODE_ENV
);
const DigitizationLabPage = isDigitizationLabEnvironment
  ? React.lazy(() => import(
    "./digitization/experiments/DigitizationLabPage"
  ))
  : null;

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/play/:id" element={<Play />} />
      {DigitizationLabPage && (
        <Route
          path="/digitization-lab"
          element={(
            <React.Suspense fallback={null}>
              <DigitizationLabPage />
            </React.Suspense>
          )}
        />
      )}
    </Routes>
  </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
