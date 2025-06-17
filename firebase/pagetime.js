import { db, getUsername } from './config.js';
import { doc, updateDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// 使用者名稱與頁面資訊
const username = getUsername();
const pageName = window.location.pathname.split("/").pop().replace(".html", "");

// 台灣本地時間（yyyy-mm-dd）
const now = new Date();
const today = now.toLocaleDateString('zh-TW', {
year: 'numeric',
month: '2-digit',
day: '2-digit'
}).replaceAll('/', '-');

const userDocRef = doc(db, "mid_users", username);
let pageStartTime = Date.now();

async function savePageTime() {
const duration = Math.floor((Date.now() - pageStartTime) / 1000);
if (!pageName || !today || isNaN(duration) || duration <= 0) return;

try {
    await updateDoc(userDocRef, {
    [`pageLogs.${pageName}.${today}`]: increment(duration)
    });
    console.log(`✅ 記錄 ${duration} 秒 → ${pageName}｜${today}`);
} catch (e) {
    if (e.code === "not-found") {
    await setDoc(userDocRef, {
        pageLogs: {
        [pageName]: {
            [today]: duration
        }
        }
    });
    console.log(`📦 新增頁面紀錄：${pageName}｜${today}`);
    } else {
    console.error("❌ Firestore 儲存失敗", e);
    }
}
}

// ⬇️ 攔截所有 <a> 連結，儲存資料後延遲跳轉
document.querySelectorAll("a[href]").forEach(link => {
link.addEventListener("click", async (e) => {
    e.preventDefault(); // 阻止預設跳轉
    const href = link.getAttribute("href");

    await savePageTime(); // 儲存資料
    setTimeout(() => {
    window.location.href = href; // 延遲後跳轉
    }, 100); // 可依需求調整延遲時間
});
});

// 備用：pagehide（確保非點擊連結離開也能儲存）
window.addEventListener("pagehide", () => {
savePageTime();
});
