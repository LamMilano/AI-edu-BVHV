import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/* Dự án này KHÔNG dùng database "(default)". Firebase Console luôn mở
   "(default)", nên tạo document hay publish rules ở đó là app không thấy gì
   cả. Xuất databaseId ra ngoài để màn đăng nhập hiển thị được, thay vì bắt
   người vận hành đi mò trong file cấu hình. */
const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
const db = getFirestore(app, databaseId);

const auth = getAuth(app);

export { app, db, auth, databaseId };
