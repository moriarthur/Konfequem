import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const link = document.createElement("link");
link.rel = "icon";
link.type = "image/x-icon";
link.href = "/favicon_Konfequem.ico";
document.head.appendChild(link);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
