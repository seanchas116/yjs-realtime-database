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
import { getDatabase, ref, onChildAdded, push, get } from "firebase/database";
import { Buffer } from "buffer";
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
const database = getDatabase(app);

window.addEventListener("load", () => {
  const ydoc = new Y.Doc();
  // const provider = new WebsocketProvider(
  //   "wss://demos.yjs.dev",
  //   "monaco-demo",
  //   ydoc
  // );
  const ytext = ydoc.getText("monaco");

  const awareness = new Awareness(ydoc);

  get(ref(database, "doc")).then((snapshot) => {
    for (const updateBase64 of Object.values(snapshot.val())) {
      const update = new Uint8Array(
        Buffer.from(updateBase64 as string, "base64")
      );
      Y.applyUpdate(ydoc, update);
    }
  });

  onChildAdded(ref(database, "doc"), (data) => {
    const updateBase64 = data.val();
    const update = new Uint8Array(
      Buffer.from(updateBase64 as string, "base64")
    );
    Y.applyUpdate(ydoc, update);
  });

  ydoc.on("update", (update: Uint8Array) => {
    const updateBase64 = Buffer.from(update).toString("base64");
    push(ref(database, "doc"), updateBase64);
  });

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
    new Set([editor]),
    awareness
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
  window.example = { ydoc, ytext, monacoBinding };
});
