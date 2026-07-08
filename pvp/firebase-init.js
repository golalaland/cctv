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
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const app = initializeApp(firebaseConfig);

// Named database — the "pvp" DB inside the dettyverse project
const db = getFirestore(app, "pvp");
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
