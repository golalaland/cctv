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
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "dettyverse.firebaseapp.com",
  projectId: "dettyverse",
  storageBucket: "dettyverse.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Named database "cassava" — keeps this product's data isolated from
// CUBE / BidBanta / CHRGE+ / Gring inside the same dettyverse project.
export const db = getFirestore(app, "cassava");
export const storage = getStorage(app);

export { setPersistence, browserLocalPersistence, browserSessionPersistence };
