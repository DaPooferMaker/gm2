/**
 * 
 * @returns {Promise<IDBDatabase>}
 */
function openGameDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("BalatroCacheDB", 1);

        request.onupgradeneeded = () => {
            request.result.createObjectStore("cache");
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadCachedGame(key="vanilla") {
    const db = await openGameDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("cache", "readonly");
        const store = tx.objectStore("cache");
        const getReq = store.get(key);

        // Issue #1: run db.close so that other tabs can access the database
        getReq.onsuccess = () => {
            db.close()
            resolve(getReq.result || null);
        };
        getReq.onerror = () => {
            db.close()
            reject(putReq.error)
        };
    });
}

async function saveGameToCache(blob, key="vanilla") {
    const db = await openGameDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("cache", "readwrite");
        const store = tx.objectStore("cache");
        const putReq = store.put(blob, key);

        putReq.onsuccess = () => {
            db.close()
            resolve();
        };
        putReq.onerror = () => {
            db.close()
            reject(putReq.error)
        };
    });
}

async function deleteCachedGame(key) {
    const db = await openGameDB()
    return new Promise((res, rej) => {
        const tx = db.transaction("cache", "readwrite");
        const store = tx.objectStore("cache");
        const deleteReq = store.delete(key)

        deleteReq.onsuccess = () => {
            db.close()
            res();
        };
        deleteReq.onerror = () => {
            db.close()
            rej(deleteReq.error)
        };
    })
}

async function listCachedVersions() {
    const db = await openGameDB()
    const tx = db.transaction("cache", "readonly")
    const store = tx.objectStore("cache")

    return new Promise((res, rej) => {
        const found_types = []

        const cursor = store.openCursor()
        cursor.onsuccess = (evt) => {
            /** @type {IDBCursorWithValue | undefined} */
            const cursor = evt.target.result
            if (cursor) {
                found_types.push(cursor.key)

                cursor.continue()
            } else {
                db.close()
                res(found_types)
            }
        }
        cursor.onerror = () => {
            db.close()
        }
    })
}