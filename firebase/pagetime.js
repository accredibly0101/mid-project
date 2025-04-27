import { db, getUsername } from './config.js';
import { doc, updateDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// 使用者名稱
const username = getUsername();
const pageName = window.location.pathname.split("/").pop().replace(".html", "");
const today = new Date().toISOString().split("T")[0];
const userDocRef = doc(db, "users", username);

let pageStartTime = Date.now(); // ⬅️ 記錄開始時間
let isVisible = true; // ⬅️ 預設頁面一開始是可見的

async function savePageTime(duration) {
    try {
        if (!pageName || !today || isNaN(duration)) throw new Error("資料格式錯誤");

        await updateDoc(userDocRef, {
            [`pageLogs.${pageName}.${today}`]: increment(duration)
        });

        console.log(`✅ 累加 ${duration} 秒 → ${pageName}｜${today}`);
    } catch (e) {
        if (e.code === "not-found") {
            await setDoc(userDocRef, {
                pageLogs: {
                    [pageName]: {
                        [today]: duration
                    }
                }
            });
            console.log(`📦 新增用戶與頁面紀錄：${pageName}｜${today}`);
        } else {
            console.error("❌ Firestore 儲存失敗", e);
        }
    }
}

function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
        if (isVisible) { // 從可見 → 變成隱藏
            const duration = Math.floor((Date.now() - pageStartTime) / 1000);
            if (duration > 0) savePageTime(duration);
            isVisible = false;
        }
    } else if (document.visibilityState === "visible") {
        pageStartTime = Date.now(); // 回到可見 → 重新開始計時
        isVisible = true;
    }
}

function handleBeforeUnload() {
    if (isVisible) { // 離開時只有可見狀態才存
        const duration = Math.floor((Date.now() - pageStartTime) / 1000);
        if (duration > 0) savePageTime(duration);
    }
}

// 綁定事件
document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("beforeunload", handleBeforeUnload);


// visibilitychange 儲存
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        const duration = Math.floor((Date.now() - pageStartTime) / 1000);
        if (duration > 0) savePageTime(duration);
        }
    });
    
    // beforeunload 儲存
    window.addEventListener('beforeunload', () => {
        const duration = Math.floor((Date.now() - pageStartTime) / 1000);
        if (duration > 0) savePageTime(duration);
    });