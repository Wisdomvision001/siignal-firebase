// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAje-pLS8mlrWAbTiv4_p3Lg-kWxFk0iRA",
  authDomain: "signal-ede28.firebaseapp.com",
  projectId: "signal-ede28",
  storageBucket: "signal-ede28.firebasestorage.app",
  messagingSenderId: "525928268929",
  appId: "1:525928268929:web:2652d7bac7133407a97980",
  measurementId: "G-LRKP0DDQK1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);