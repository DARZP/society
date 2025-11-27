// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCFNsLCBWD8z9agBPmJ4Kh4lpKY8hbbFPc",
  authDomain: "society-b62fe.firebaseapp.com",
  projectId: "society-b62fe",
  storageBucket: "society-b62fe.firebasestorage.app",
  messagingSenderId: "113498579108",
  appId: "1:113498579108:web:fc249ef2d0262801440631"
};

// Inicializamos la conexión
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
