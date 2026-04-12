import { makeInMemoryStore } from "../lib/Store";
import fs from "fs";

// Bikin instance store-nya
export const store = makeInMemoryStore({});

// Load data lama kalau ada
const storePath = './db/baileys_store.json';
if (fs.existsSync(storePath)) {
    store.readFromFile(storePath);
}

// Auto-save tiap 10 detik
setInterval(() => {
    store.writeToFile(storePath);
}, 10_000);