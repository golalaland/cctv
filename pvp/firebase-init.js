// firebase-init.js — shared Firebase spine for PvP (dettyverse / "pvp" database)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs,
  onSnapshot, query, where, orderBy, addDoc, setDoc,
  updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ── Fill these from Project settings → your web app ──
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

// Named database — the "pvp" DB inside the dettyverse project
const db = getFirestore(app, "pvpstrip");
const auth = getAuth(app);
const storage = getStorage(app);

export {
  app, db, auth, storage,
  // firestore
  collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy,
  addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp,
  // auth
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  // storage
  storageRef, uploadBytesResumable, getDownloadURL, deleteObject
};
