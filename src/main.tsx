import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { Awareness } from "y-protocols/awareness";
import { initializeApp } from "firebase/app";
import * as db from "firebase/database";
import "./index.css";
import { firebaseProvider } from "./lib";

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

const firebaseConfig = {
  apiKey: "AIzaSyChTWSFwlBcBMT-nQMIdZ_PRbo1LYRD1mM",
  authDomain: "yjs-realtime-database.firebaseapp.com",
  databaseURL: "https://yjs-realtime-database-default-rtdb.firebaseio.com",
  projectId: "yjs-realtime-database",
  storageBucket: "yjs-realtime-database.appspot.com",
  messagingSenderId: "302334531831",
  appId: "1:302334531831:web:b6d9864c5f0b7fe0155bf2",
};

const app = initializeApp(firebaseConfig);
const database = db.getDatabase(app);

window.addEventListener("load", () => {
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText("monaco");
  const awareness = new Awareness(ydoc);

  firebaseProvider({
    ydoc,
    database,
    path: "example",
    awareness,
  });

  const editor = monaco.editor.create(
    document.getElementById("monaco-editor")!,
    {
      value: "",
      language: "javascript",
      theme: "vs-dark",
    }
  );
  const monacoBinding = new MonacoBinding(
    ytext,
    editor.getModel()!,
    new Set([editor]),
    awareness
  );

  // @ts-ignore
  window.example = { ydoc, ytext, monacoBinding };
});
