import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { initializeApp } from "firebase/app";
import * as db from "firebase/database";
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
const database = db.getDatabase(app);

window.addEventListener("load", () => {
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText("monaco");

  const awareness = new Awareness(ydoc);

  let duringRemoteUpdate = false;
  const remoteUpdate = (action: () => void) => {
    try {
      duringRemoteUpdate = true;
      action();
    } finally {
      duringRemoteUpdate = false;
    }
  };

  db.get(db.ref(database, "doc")).then((snapshot) => {
    console.log("first read");

    const data = snapshot.val() ?? {};

    remoteUpdate(() => {
      ydoc.transact(() => {
        for (const updateBase64 of Object.values(data)) {
          const update = new Uint8Array(
            Buffer.from(updateBase64 as string, "base64")
          );
          Y.applyUpdate(ydoc, update);
        }
      });
    });

    // flush database (idea from y-leveldb)

    const flushed = Y.encodeStateAsUpdate(ydoc);
    db.push(db.ref(database, "doc"), Buffer.from(flushed).toString("base64"));
    for (const key of Object.keys(data)) {
      db.remove(db.ref(database, `doc/${key}`));
    }

    // listen for new updates

    const lastKey = Object.keys(data).pop();
    db.onChildAdded(
      lastKey
        ? db.query(
            db.ref(database, "doc"),
            db.orderByKey(),
            db.startAfter(lastKey)
          )
        : db.ref(database, "doc"),
      (snapshot) => {
        console.log("child added");

        const update = new Uint8Array(
          Buffer.from(snapshot.val() as string, "base64")
        );

        remoteUpdate(() => {
          Y.applyUpdate(ydoc, update);
        });
      }
    );
  });

  ydoc.on("update", (update: Uint8Array) => {
    if (duringRemoteUpdate) {
      return;
    }
    // only send local updates

    console.log("update");

    const updateBase64 = Buffer.from(update).toString("base64");
    db.push(db.ref(database, "doc"), updateBase64);
  });

  // awareness

  awareness.on("update", ({ updated }: { updated: number[] }) => {
    console.log("update awareness");

    if (updated.includes(awareness.clientID)) {
      const data = encodeAwarenessUpdate(awareness, [awareness.clientID]);

      db.set(
        db.ref(database, `awareness/${awareness.clientID}`),
        Buffer.from(data).toString("base64")
      );
    }
  });

  db.onDisconnect(db.ref(database, `awareness/${awareness.clientID}`)).set(
    null
  );

  db.onValue(db.ref(database, "awareness"), (snapshot) => {
    console.log("awareness", snapshot.val());

    const ids = new Set<number>();

    for (const [idText, base64] of Object.entries(snapshot.val() ?? {})) {
      const id = parseInt(idText);
      if (id === awareness.clientID) {
        continue;
      }

      const data = new Uint8Array(Buffer.from(base64 as string, "base64"));
      applyAwarenessUpdate(awareness, data, id);
      ids.add(id);
    }

    for (const id of awareness.getStates().keys()) {
      if (!ids.has(id) && id !== awareness.clientID) {
        removeAwarenessStates(awareness, [id], id);
      }
    }
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
