import { auth, db } from "./config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

let expiryTimer = null;

function redirectExpired() {
window.location.replace("expired.html");
}

function clearExpiryTimer() {
if (expiryTimer) {
clearTimeout(expiryTimer);
expiryTimer = null;
}
}

function scheduleExpiry(expiresAtDate) {
clearExpiryTimer();

const msLeft = expiresAtDate.getTime() - Date.now();

// 已到期或時間異常 -> 立刻導走
if (!Number.isFinite(msLeft) || msLeft <= 0) {
redirectExpired();
return;
}

expiryTimer = setTimeout(async () => {
try { await signOut(auth); } catch (e) {}
redirectExpired();
}, msLeft);
}

async function guard(user) {
const ref = doc(db, "mid-users", user.uid);
const snap = await getDoc(ref);

// ✅ 1) 沒有任何資料：允許進入（你之後再手動補 expiresAt/status）
if (!snap.exists()) {
return { ok: true, reason: "no_profile_allow" };
}

const data = snap.data();

// ✅ 2) 先處理 status（只要不是 active 就擋）
const status = (data.status ?? "active").toString().trim();
if (status !== "active") return { ok: false, reason: `status:${status}` };

// ✅ 3) 再處理 expiresAt（只要存在且已過期就擋）
const expiresAt = data.expiresAt?.toDate?.() || null;

// 沒 expiresAt：允許進入（代表你還沒啟用期限控管）
if (!expiresAt) {
return { ok: true, reason: "no_expiresAt_allow" };
}

// 有 expiresAt：已過期就擋（status 仍是 active 也照擋）
if (Date.now() > expiresAt.getTime()) return { ok: false, reason: "expired" };

// 還沒到期：設定計時器
scheduleExpiry(expiresAt);
return { ok: true };
}

onAuthStateChanged(auth, async (user) => {
clearExpiryTimer();

if (!user) return;

const res = await guard(user);
if (!res.ok) {
try { await signOut(auth); } catch (e) {}
redirectExpired();
}
});
