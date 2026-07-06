// firebase-config.js
// Shared Firebase v11 initialization for Cassava.
// Follows the DettyVerse pattern: one Firebase project, one named Firestore
// database per product. Drop your real config values in below.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";

// TODO: replace with your real DettyVerse web app config
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

const app = initializeApp(firebaseConfig);

// ====================== DATABASE SELECTION ======================
const TARGET_DATABASE = "chrge";   // ← Change this line when needed

const db = getFirestore(app, TARGET_DATABASE);
const auth = getAuth(app);
const functions = getFunctions(app, "europe-west1");   // Better for Nigeria

console.log(`📦 Connected to Firestore Database: ${TARGET_DATABASE}`);
console.log("☁️ Functions region: europe-west1");

// Named database "cassava" — keeps this product's data isolated from
// CUBE / BidBanta / CHRGE+ / Gring inside the same dettyverse project.
export const db = getFirestore(app, "chrge");
export const storage = getStorage(app);

export { setPersistence, browserLocalPersistence, browserSessionPersistence };
