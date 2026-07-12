// firebase-init.js
//
// Initializes the Firebase app and exports the services every page needs
// (Auth, Firestore, Storage). Every HTML page imports this as an ES module:
//   <script type="module" src="firebase-init.js"></script>
// or imports specific pieces from it, e.g.:
//   import { auth, db, storage } from './firebase-init.js';
//
// ============================================================================
// REPLACE THIS WITH YOUR OWN FIREBASE PROJECT CONFIG
// ============================================================================
// 1. Go to https://console.firebase.google.com/ and create a project.
// 2. In the project, add a "Web app" (</> icon) — this gives you the config
//    object below.
// 3. Enable these products in the left sidebar:
//      - Authentication -> Sign-in method -> enable "Email/Password" AND
//        "Anonymous" (anonymous is used for citizen report submissions).
//      - Firestore Database -> Create database (start in production mode,
//        then paste in firestore.rules — see README).
//      - Storage -> Get started (then paste in storage.rules — see README).
// 4. Paste your real config below, replacing every "REPLACE_ME" value.
// ============================================================================

const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
  connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  connectStorageEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Firestore's offline persistence means reports queued while the device has
// no signal will sync automatically the moment connectivity returns. This
// is what "offline-tolerant submission" actually means in this build —
// no custom retry queue needed, Firestore's SDK already does this.
enableIndexedDbPersistence(db).catch((error) => {
  // Fails if multiple tabs are open at once, or in some private-browsing
  // modes — the app still works, it just won't cache offline in that tab.
  console.warn("Offline persistence unavailable in this tab:", error.code);
});

// If you're running against the local Firebase Emulator Suite for
// development (optional, see README), uncomment these three lines:
// connectAuthEmulator(auth, "http://127.0.0.1:9099");
// connectFirestoreEmulator(db, "127.0.0.1", 8080);
// connectStorageEmulator(storage, "127.0.0.1", 9199);

export { app, auth, db, storage, firebaseConfig };
