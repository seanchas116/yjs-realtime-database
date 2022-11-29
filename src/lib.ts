import * as db from "firebase/database";
import * as Y from "yjs";
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { Buffer } from "buffer";

function toBase64(update: Uint8Array): string {
  return Buffer.from(update).toString("base64");
}

function fromBase64(base64str: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64str, "base64"));
}

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

    const data: Record<string, string> = snapshot.val() ?? {};

    remoteUpdate(() => {
      ydoc.transact(() => {
        for (const updateBase64 of Object.values(data)) {
          const update = fromBase64(updateBase64);
          Y.applyUpdate(ydoc, update);
        }
      });
    });

    // flush database (idea from y-leveldb)

    if (Object.keys(data).length > 1) {
      const flushed = Y.encodeStateAsUpdate(ydoc);
      db.push(db.ref(database, docPath), toBase64(flushed));
      for (const key of Object.keys(data)) {
        db.remove(db.ref(database, `${docPath}/${key}`));
      }
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

        const update = fromBase64(snapshot.val());

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
    db.push(db.ref(database, docPath), toBase64(update));
  });

  // awareness

  if (awareness) {
    const awarenessPath = `${path}/awareness`;

    awareness.on(
      "update",
      ({ updated, removed }: { updated: number[]; removed: number[] }) => {
        console.log("update awareness");

        if (updated.includes(awareness.clientID)) {
          const data = encodeAwarenessUpdate(awareness, [awareness.clientID]);

          db.set(
            db.ref(database, `${awarenessPath}/${awareness.clientID}`),
            toBase64(data)
          );
        }

        // timed out clients
        for (const clientID of removed) {
          db.remove(db.ref(database, `${awarenessPath}/${clientID}`));
        }
      }
    );

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

        const data = fromBase64(base64 as string);
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
