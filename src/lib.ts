import * as db from "firebase/database";
import * as Y from "yjs";
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { Buffer } from "buffer";

export function firebaseProvider({
  ydoc,
  database,
  path,
  awareness,
}: {
  ydoc: Y.Doc;
  database: db.Database;
  path: string;
  awareness?: Awareness;
}) {
  let duringRemoteUpdate = false;
  const remoteUpdate = (action: () => void) => {
    try {
      duringRemoteUpdate = true;
      action();
    } finally {
      duringRemoteUpdate = false;
    }
  };

  const docPath = `${path}/doc`;

  db.get(db.ref(database, docPath)).then((snapshot) => {
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
    db.push(db.ref(database, docPath), Buffer.from(flushed).toString("base64"));
    for (const key of Object.keys(data)) {
      db.remove(db.ref(database, `${docPath}/${key}`));
    }

    // listen for new updates

    const lastKey = Object.keys(data).pop();
    db.onChildAdded(
      lastKey
        ? db.query(
            db.ref(database, docPath),
            db.orderByKey(),
            db.startAfter(lastKey)
          )
        : db.ref(database, docPath),
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
    db.push(db.ref(database, docPath), updateBase64);
  });

  // awareness

  if (awareness) {
    const awarenessPath = `${path}/awareness`;

    awareness.on("update", ({ updated }: { updated: number[] }) => {
      console.log("update awareness");

      if (updated.includes(awareness.clientID)) {
        const data = encodeAwarenessUpdate(awareness, [awareness.clientID]);

        db.set(
          db.ref(database, `${awarenessPath}/${awareness.clientID}`),
          Buffer.from(data).toString("base64")
        );
      }
    });

    db.onDisconnect(
      db.ref(database, `${awarenessPath}/${awareness.clientID}`)
    ).set(null);

    db.onValue(db.ref(database, awarenessPath), (snapshot) => {
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
  }
}
