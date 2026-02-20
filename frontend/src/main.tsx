import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

// NOTE:
// Yandex Maps JS API v3 может нестабильно работать в dev-режиме под React.StrictMode
// (двойной mount/unmount вызывает ошибки вида Node.removeChild).
// Поэтому StrictMode здесь отключён.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
