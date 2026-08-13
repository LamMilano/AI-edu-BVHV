/* Script sửa dữ liệu tạm thời — xoá sau khi xong.

   VẤN ĐỀ: 3 người ở Khoa Nội cùng dùng khoanoibvhv@gmail.com để nộp phiếu.
   Hồ sơ lấy email làm Document ID nên chỉ 1 trong 3 người có hồ sơ.

   CÁCH SỬA: đổi email của 2 phiếu bị nuốt sang dạng alias "+tên". Gmail vẫn
   chuyển thư về đúng hộp chung của khoa, còn Firestore coi đây là 3 ID khác
   nhau nên cả 3 đều có hồ sơ riêng.

   Chạy thử (KHÔNG ghi gì):
     $env:FB_EMAIL="..."; $env:FB_PASSWORD='...'; node fix-email-trung.mjs
   Chạy thật:
     node fix-email-trung.mjs --apply                                      */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

const cfg = JSON.parse(readFileSync(new URL("./firebase-applet-config.json", import.meta.url)));
const email = process.env.FB_EMAIL;
const password = process.env.FB_PASSWORD;
const APPLY = process.argv.includes("--apply");

if (!email || !password) {
  console.error("Thieu FB_EMAIL hoac FB_PASSWORD trong bien moi truong.");
  process.exit(1);
}

/* Chỉ đụng vào ĐÚNG hai phiếu này. ID lấy từ kết quả diag-hoso.mjs.
   tenMongDoi dùng để chặn nhầm document: tên trong phiếu phải khớp thì
   mới ghi, tránh trường hợp ID bị chép sai hoặc dữ liệu đã đổi. */
const TARGETS = [
  {
    id: "8TwUdD9Iyyafc3DVrPlf",
    tenMongDoi: "HOÀNG THỊ NGỌC",
    emailCu: "khoanoibvhv@gmail.com",
    emailMoi: "khoanoibvhv+ngoc@gmail.com",
  },
  {
    id: "m4hBTs5bOogGBrK7JmEp",
    tenMongDoi: "phan thị tâm",
    emailCu: "khoanoibvhv@gmail.com",
    emailMoi: "khoanoibvhv+tam@gmail.com",
  },
];

const app = initializeApp(cfg);

console.log(APPLY
  ? "=== CHE DO GHI THAT (--apply) ==="
  : "=== CHE DO XEM TRUOC — khong ghi gi. Them --apply de sua that ===");

try {
  const cred = await signInWithEmailAndPassword(getAuth(app), email.trim(), password);
  console.log("Dang nhap OK. UID:", cred.user.uid);
} catch (e) {
  console.log("DANG NHAP THAT BAI:", e.code);
  process.exit(1);
}

const db = getFirestore(app, cfg.firestoreDatabaseId);

let sanSang = 0;
let boQua = 0;

for (const t of TARGETS) {
  console.log(`\n──────── Phieu ${t.id} ────────`);
  const ref = doc(db, "survey_submissions", t.id);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (e) {
    console.log("LOI khi doc:", e.code || e.message);
    boQua++;
    continue;
  }

  if (!snap.exists()) {
    console.log("BO QUA: khong tim thay phieu nay (co the da bi xoa).");
    boQua++;
    continue;
  }

  const data = snap.data();
  console.log("Ten trong phieu :", data.studentName);
  console.log("Khoa/Phong      :", data.department || "(trong)");
  console.log("Email hien tai  :", data.email);

  if (data.studentName !== t.tenMongDoi) {
    console.log(`BO QUA: ten khong khop (mong doi "${t.tenMongDoi}"). Khong ghi de cho chac.`);
    boQua++;
    continue;
  }

  if (data.email === t.emailMoi) {
    console.log("BO QUA: email da duoc sua tu truoc roi.");
    boQua++;
    continue;
  }

  if (data.email !== t.emailCu) {
    console.log(`BO QUA: email hien tai khong phai "${t.emailCu}". Khong ghi de cho chac.`);
    boQua++;
    continue;
  }

  console.log("Email SE DOI THANH:", t.emailMoi);

  if (APPLY) {
    try {
      await updateDoc(ref, { email: t.emailMoi });
      console.log(">>> DA GHI XONG.");
      sanSang++;
    } catch (e) {
      console.log("LOI khi ghi:", e.code || e.message);
      boQua++;
    }
  } else {
    sanSang++;
  }
}

console.log("\n══════════════ KET QUA ══════════════");
if (APPLY) {
  console.log(`Da sua: ${sanSang} phieu | Bo qua: ${boQua} phieu`);
  if (sanSang > 0) {
    console.log("\nBUOC TIEP THEO (bat buoc):");
    console.log("  Mo app -> tab Quan tri -> Hoc vien -> Ho so");
    console.log("  -> bam nut \"Dung lai ho so tu phieu\"");
    console.log("  Sau do so ho so phai la 99.");
  }
} else {
  console.log(`San sang sua: ${sanSang} phieu | Bo qua: ${boQua} phieu`);
  console.log("\nChua ghi gi ca. Neu so lieu tren dung, chay lai voi:");
  console.log("  node fix-email-trung.mjs --apply");
}

process.exit(0);
