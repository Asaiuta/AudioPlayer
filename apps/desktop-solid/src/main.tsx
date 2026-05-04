import { render } from "solid-js/web";
import App from "./app/App";
import "./shared/styles/global.css";
import "virtual:uno.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

render(() => <App />, root);
