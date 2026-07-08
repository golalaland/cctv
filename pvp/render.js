// render.js — shared render/query helpers for public + admin
import { db, doc, onSnapshot, collection, query, orderBy, getDocs } from "./firebase-init.js";

// Safe text setter — never throws if node is missing
export function setText(id, value) {
  const el = document.getElementById(id);
  if (el != null && value != null) el.textContent = value;
}

// Live single-doc binding with fallback defaults
export function bindDoc(path, onData, defaults = {}) {
  const [col, id] = path.split("/");
  return onSnapshot(doc(db, col, id), (snap) => {
    onData(snap.exists() ? { id: snap.id, ...snap.data() } : { ...defaults });
  }, (err) => {
    console.warn(`bindDoc(${path}) error, using defaults:`, err);
    onData({ ...defaults });
  });
}

// Live collection binding, ordered, with fallback to []
export function bindCollection(colName, onData, orderField = "order") {
  const q = query(collection(db, colName), orderBy(orderField));
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.warn(`bindCollection(${colName}) error:`, err);
    onData([]);
  });
}

// Escape user/CMS text before inserting as HTML
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]
  ));
}
