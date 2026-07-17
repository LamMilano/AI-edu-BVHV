import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with the specific database ID if provided, or default
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

export { app, db };
