import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import "./index.css";

// @ts-ignore
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

window.addEventListener("load", () => {
  const ydoc = new Y.Doc();
  // const provider = new WebsocketProvider(
  //   "wss://demos.yjs.dev",
  //   "monaco-demo",
  //   ydoc
  // );
  const ytext = ydoc.getText("monaco");

  const editor = monaco.editor.create(
    /** @type {HTMLElement} */ document.getElementById("monaco-editor")!,
    {
      value: "",
      language: "javascript",
      theme: "vs-dark",
    }
  );
  const monacoBinding = new MonacoBinding(
    ytext,
    /** @type {monaco.editor.ITextModel} */ editor.getModel()!,
    new Set([editor])
    //provider.awareness
  );

  const connectBtn =
    /** @type {HTMLElement} */ document.getElementById("y-connect-btn")!;
  connectBtn.addEventListener("click", () => {
    // if (provider.shouldConnect) {
    //   provider.disconnect();
    //   connectBtn.textContent = "Connect";
    // } else {
    //   provider.connect();
    //   connectBtn.textContent = "Disconnect";
    // }
  });

  // @ts-ignore
  window.example = { provider, ydoc, ytext, monacoBinding };
});
