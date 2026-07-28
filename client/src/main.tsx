/**
 * ByteBites React client entry point.
 *
 * Mounts <App/> (the route table) inside a <BrowserRouter> into the #root
 * element defined in index.html. Pages and components are filled in by tasks
 * 13-16; this task wires the shell, router, and navigation.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import "./styles/global.css";

export const APP_NAME = "ByteBites";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}
