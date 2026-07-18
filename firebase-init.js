// firebase-init.js
//
// Initializes the Firebase app and exports the services every page needs
// (Auth, Firestore, Storage).

const firebaseConfig = {
  apiKey: "AIzaSyAje-pLS8mlrWAbTiv4_p3Lg-kWxFk0iRA",
  authDomain: "signal-ede28.firebaseapp.com",
  projectId: "signal-ede28",
  storageBucket: "signal-ede28.firebasestorage.app",
  messagingSenderId: "525928268929",
  appId: "1:525928268929:web:2652d7bac7133407a97980",
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Firestore's offline persistence means reports queued while the device has
// no signal will sync automatically the moment connectivity returns.
// enableIndexedDbPersistence(db).catch((error) => {
//   // Fails if multiple tabs are open at once, or in some private-browsing
//   // modes — the app still works, it just won't cache offline in that tab.
//   console.warn("Offline persistence unavailable in this tab:", error.code);
// });

export { app, auth, db, storage, firebaseConfig };
