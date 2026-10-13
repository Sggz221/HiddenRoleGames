import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/grenze-gotisch/500.css";
import "@fontsource/grenze-gotisch/800.css";
import "./i18n";
import { session } from "./net/client";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

session.start();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
