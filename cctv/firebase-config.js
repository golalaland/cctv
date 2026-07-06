// firebase-config.js
// Shared Firebase v11 initialization for DettyVerse products.
// One Firebase project, one named Firestore database per product —
// change TARGET_DATABASE below to point this file at a different product.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js";

// ---------- FIREBASE CONFIG ----------
const firebaseConfig = {
  apiKey: "AIzaSyD_GjkTox5tum9o4AupO0LeWzjTocJg8RI",
  authDomain: "dettyverse.firebaseapp.com",
  projectId: "dettyverse",
  storageBucket: "dettyverse.firebasestorage.app",
  messagingSenderId: "1036459652488",
  appId: "1:1036459652488:web:e8910172ed16e9cac9b63d",
  measurementId: "G-NX2KWZW85V"
};

// ====================== DATABASE SELECTION ======================
// Change this one line per product — everything else in this file stays the same.
const TARGET_DATABASE = "chrge"; // e.g. "cassava", "chrge", "cube", "bidbanta", "gring"

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, TARGET_DATABASE);
const storage = getStorage(app);
const functions = getFunctions(app, "europe-west1"); // closer region for Nigeria/Ghana traffic

console.log(`📦 Connected to Firestore database: ${TARGET_DATABASE}`);
console.log("☁️ Functions region: europe-west1");

export {
  app,
  auth,
  db,
  storage,
  functions,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
};
