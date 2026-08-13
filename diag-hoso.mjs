/* Script chẩn đoán tạm thời — xoá sau khi xong.
   Đối chiếu "số phiếu khảo sát" với "số hồ sơ" và chỉ ra TỪNG phiếu bị lệch.
   Logic chép nguyên từ src/lib/students.ts để kết quả khớp với những gì app làm.

   Chạy:  FB_EMAIL=... FB_PASSWORD=... node diag-hoso.mjs                */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const cfg = JSON.parse(readFileSync(new URL("./firebase-applet-config.json", import.meta.url)));
const email = process.env.FB_EMAIL;
const password = process.env.FB_PASSWORD;

if (!email || !password) {
  console.error("Thieu FB_EMAIL hoac FB_PASSWORD trong bien moi truong.");
  process.exit(1);
}

/* ── Chép từ src/lib/students.ts ─────────────────────────────────────── */
const MAX_DOC_ID_BYTES = 1500;

function normalizeEmail(raw) {
  const value = (raw || "").trim().toLowerCase();
  if (!value) return null;
  if (value === "." || value === "..") return null;
  if (value.includes("/")) return null;
  if (!value.includes("@")) return null;
  if (new TextEncoder().encode(value).length > MAX_DOC_ID_BYTES) return null;
  return value;
}

const submittedSeconds = (s) => s.submittedAt?.seconds || 0;
/* ────────────────────────────────────────────────────────────────────── */

const ngay = (s) => {
  const sec = submittedSeconds(s);
  if (!sec) return "(không có ngày)";
  return new Date(sec * 1000).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
};

const lyDoLoai = (raw) => {
  const v = (raw || "").trim();
  if (!v) return "email để trống";
  if (v === "." || v === "..") return `email là "${v}" — Firestore cấm làm Document ID`;
  if (v.includes("/")) return `email chứa dấu "/" — Firestore cấm làm Document ID`;
  if (!v.includes("@")) return "email không có ký tự @";
  return "email dài quá 1500 byte";
};

const app = initializeApp(cfg);

console.log("=== CAU HINH ===");
console.log("projectId          :", cfg.projectId);
console.log("firestoreDatabaseId:", cfg.firestoreDatabaseId || "(default)");

let uid;
try {
  const cred = await signInWithEmailAndPassword(getAuth(app), email.trim(), password);
  uid = cred.user.uid;
  console.log("Dang nhap OK. UID:", uid);
} catch (e) {
  console.log("DANG NHAP THAT BAI:", e.code);
  process.exit(1);
}

const db = getFirestore(app, cfg.firestoreDatabaseId);

let subs, studs;
try {
  const [sSnap, tSnap] = await Promise.all([
    getDocs(collection(db, "survey_submissions")),
    getDocs(collection(db, "students")),
  ]);
  subs = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  studs = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
} catch (e) {
  console.log("LOI khi doc du lieu:", e.code || e.message);
  console.log("(Tai khoan nay phai co users/{uid}.role = 'admin' hoac 'teacher')");
  process.exit(1);
}

/* Gom phiếu theo email đã chuẩn hoá — đúng như buildStudentsFromSubmissions. */
const byEmail = new Map();
const thieuEmail = [];
for (const s of subs) {
  const key = normalizeEmail(s.email);
  if (!key) { thieuEmail.push(s); continue; }
  byEmail.set(key, [...(byEmail.get(key) || []), s]);
}

const hoSoTheoId = new Map(studs.map(s => [s.id, s]));
// Hồ sơ nào đã nuốt hồ sơ khác qua chức năng "Gộp hồ sơ" (mergeStudents).
const daBiGopVao = new Map();
for (const st of studs) {
  for (const cu of st.mergedFrom || []) daBiGopVao.set(cu, st);
}

console.log("\n══════════════ TONG QUAN ══════════════");
console.log("Phieu khao sat trong Firestore :", subs.length);
console.log("Ho so trong Firestore          :", studs.length);
console.log("Email hop le rieng biet tu phieu:", byEmail.size, "  <-- so ho so LE RA phai co");

/* ── A. Phiếu bị loại vì email không hợp lệ ──────────────────────────── */
console.log(`\n══════════════ A. PHIEU BI BO QUA VI EMAIL KHONG HOP LE (${thieuEmail.length}) ══════════════`);
if (!thieuEmail.length) console.log("(khong co)");
thieuEmail.forEach((s, i) => {
  console.log(`${i + 1}. ${s.studentName || "(khong ten)"} | ${s.department || "(khong khoa)"} | DT: ${s.phone || "-"}`);
  console.log(`   email tho: ${JSON.stringify(s.email)}  ->  ${lyDoLoai(s.email)}`);
  console.log(`   nop luc: ${ngay(s)}   submissionId: ${s.id}`);
});

/* ── B. Nhiều phiếu chung một email → gộp thành 1 hồ sơ ──────────────── */
const trungEmail = [...byEmail.entries()].filter(([, list]) => list.length > 1);
const phieuThua = trungEmail.reduce((n, [, list]) => n + list.length - 1, 0);
console.log(`\n══════════════ B. MOT NGUOI NOP NHIEU PHIEU (${trungEmail.length} email, thua ${phieuThua} phieu) ══════════════`);
if (!trungEmail.length) console.log("(khong co)");
trungEmail.forEach(([mail, list], i) => {
  const giu = list.reduce((a, b) => (submittedSeconds(b) > submittedSeconds(a) ? b : a));
  console.log(`${i + 1}. ${mail}  —  ${list.length} phieu, giu lai 1 ho so`);
  list
    .slice()
    .sort((a, b) => submittedSeconds(b) - submittedSeconds(a))
    .forEach(s => {
      const mark = s.id === giu.id ? ">> DUNG (moi nhat)" : "   bo qua";
      console.log(`   ${mark} | ${ngay(s)} | ten: ${s.studentName} | trinh do: ${s.assignedLevel} | id: ${s.id}`);
    });
});

/* ── C. Có phiếu hợp lệ nhưng KHÔNG có hồ sơ trong Firestore ─────────── */
const thieuHoSo = [...byEmail.keys()].filter(k => !hoSoTheoId.has(k));
console.log(`\n══════════════ C. CO PHIEU HOP LE NHUNG KHONG CO HO SO (${thieuHoSo.length}) ══════════════`);
if (!thieuHoSo.length) console.log("(khong co)");
thieuHoSo.forEach((mail, i) => {
  const list = byEmail.get(mail);
  const moi = list.reduce((a, b) => (submittedSeconds(b) > submittedSeconds(a) ? b : a));
  const gop = daBiGopVao.get(mail);
  const lyDo = gop
    ? `DA BI GOP vao ho so "${gop.id}" (${gop.fullName})`
    : `CHUA DUNG LAI HO SO — bam nut "Dung lai ho so tu phieu"`;
  console.log(`${i + 1}. ${mail} | ${moi.studentName} | ${moi.department || "-"}`);
  console.log(`   nop luc: ${ngay(moi)}  ->  ${lyDo}`);
});

/* ── D. Có hồ sơ nhưng không còn phiếu nào ───────────────────────────── */
const khongPhieu = studs.filter(s => !byEmail.has(s.id));
console.log(`\n══════════════ D. CO HO SO NHUNG KHONG CON PHIEU NAO (${khongPhieu.length}) ══════════════`);
if (!khongPhieu.length) console.log("(khong co)");
khongPhieu.forEach((s, i) => {
  console.log(`${i + 1}. ${s.id} | ${s.fullName} | ${s.department || "-"} | submissionCount ghi trong ho so: ${s.submissionCount}`);
  console.log(`   -> phieu goc da bi xoa, hoac ho so duoc tao/sua bang tay`);
});

/* ── Phép cộng đối chiếu ─────────────────────────────────────────────── */
console.log("\n══════════════ DOI CHIEU ══════════════");
console.log(`${subs.length} phieu`);
console.log(`  - ${thieuEmail.length} phieu email khong hop le      (muc A)`);
console.log(`  - ${phieuThua} phieu trung email bi gop         (muc B)`);
console.log(`  = ${byEmail.size} ho so le ra phai co`);
console.log(`  - ${thieuHoSo.length} ho so chua dung lai / da gop    (muc C)`);
console.log(`  + ${khongPhieu.length} ho so khong con phieu           (muc D)`);
console.log(`  = ${byEmail.size - thieuHoSo.length + khongPhieu.length} ho so  (thuc te trong Firestore: ${studs.length})`);

process.exit(0);
