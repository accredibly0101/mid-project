// releaseGate.js
import { db } from "./config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

/**
 * 取得「台灣時區」現在時間（Date）
 * 做法：用 Intl 拿到台灣時間的各部件，再用 Date.UTC 組成「同一瞬間」的時間點
 * 優點：不依賴瀏覽器能否 parse 特定字串格式
 */
export function getNowInTaipei() {
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = fmt.formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;

    const y = Number(get("year"));
    const m = Number(get("month"));
    const d = Number(get("day"));
    const hh = Number(get("hour"));
    const mm = Number(get("minute"));
    const ss = Number(get("second"));

  // 這裡用 UTC 組一個時間，再扣掉台灣固定 +8 小時，得到正確的「當下瞬間」Date
  // Asia/Taipei 無 DST，所以固定 +8
    const utcMs = Date.UTC(y, m - 1, d, hh - 8, mm, ss);
    return new Date(utcMs);
}

/** 從 Firestore 讀 release 設定 */
export async function loadReleaseConfig() {
    const snap = await getDoc(doc(db, "config", "release"));
    if (!snap.exists()) {
        // 沒設定就當全部開放
        return { units: {} };
    }
    return snap.data();
}

/**
 * 將 Firestore 裡的 openAt 轉成 Date
 * 支援：
 * - Firestore Timestamp (有 toDate())
 * - string (ISO 字串)
 * - number (毫秒)
 * - Date
 */
export function toDateMaybe(value) {
if (!value) return null;

  // Firestore Timestamp
if (typeof value?.toDate === "function") return value.toDate();

  // 已經是 Date
if (value instanceof Date) return value;

  // string / number
return new Date(value);
}

/** 判斷某單元是否已開放 */
export function isUnitOpen(releaseConfig, unitKey, now = getNowInTaipei()) {
const rule = releaseConfig?.units?.[unitKey];
if (!rule?.openAt) return true; // 沒規則 => 開放

const openAt = toDateMaybe(rule.openAt);
if (!openAt || Number.isNaN(openAt.getTime())) {
    // openAt 格式不對：保守作法 => 當作未開放（避免誤放出）
    return false;
}

return now >= openAt;
}

/** 給元素上鎖 / 解鎖 */
export function setLocked(el, locked) {
    el.classList.toggle("locked", locked);
    el.setAttribute("aria-disabled", locked ? "true" : "false");
}

/** 小提示（你也可以換成你自己的 toast UI） */
export function showLockedMessage(msg = "此單元尚未開放，請稍後再試") {
    alert(msg);
}
