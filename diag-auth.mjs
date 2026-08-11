/* Script chẩn đoán tạm thời — xoá sau khi xong.
   Chạy đúng luồng của src/lib/authz.ts để xem app THỰC SỰ đọc được gì. */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const cfg = JSON.parse(readFileSync(new URL("./firebase-applet-config.json", import.meta.url)));
const email = process.env.FB_EMAIL;
const password = process.env.FB_PASSWORD;

if (!email || !password) {
  console.error("Thieu FB_EMAIL hoac FB_PASSWORD trong bien moi truong.");
  process.exit(1);
}

const app = initializeApp(cfg);

console.log("=== CAU HINH APP DANG DUNG ===");
console.log("projectId          :", cfg.projectId);
console.log("firestoreDatabaseId:", cfg.firestoreDatabaseId || "(default)");

console.log("\n=== BUOC 1: DANG NHAP ===");
let uid;
try {
  const cred = await signInWithEmailAndPassword(getAuth(app), email.trim(), password);
  uid = cred.user.uid;
  console.log("OK. Dang nhap thanh cong.");
  console.log("UID app nhin thay :", JSON.stringify(uid));
  console.log("Do dai UID        :", uid.length);
} catch (e) {
  console.log("THAT BAI:", e.code);
  process.exit(1);
}

/* Doc users/{uid} tren tung database de biet document nam o dau. */
async function probe(label, dbId) {
  console.log(`\n=== BUOC 2: DOC users/${uid} tren database ${label} ===`);
  try {
    const db = getFirestore(app, dbId);
    const snap = await getDoc(doc(db, "users", uid));
    console.log("Doc duoc. exists() =", snap.exists());
    if (snap.exists()) {
      const data = snap.data();
      console.log("Du lieu:", JSON.stringify(data));
      console.log("role    :", JSON.stringify(data.role), "| kieu:", typeof data.role);
      const ok = data.role === "admin" || data.role === "teacher";
      console.log(ok ? ">>> HOP LE. App phai dang nhap duoc." : ">>> role SAI GIA TRI (phai la 'admin' hoac 'teacher').");
    } else {
      console.log(">>> KHONG CO document nay o database", label);
    }
  } catch (e) {
    console.log("LOI khi doc:", e.code || e.message);
  }
}

await probe("ai-studio (app dang dung)", cfg.firestoreDatabaseId);
await probe("(default)", "(default)");

process.exit(0);
