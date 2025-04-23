import { db } from './config.js';
import {
doc,
setDoc,
updateDoc,
increment,
FieldPath
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const username = "anonymous";
const pageName = window.location.pathname.split("/").pop().replace(".html", "");
const today = new Date().toISOString().split("T")[0];
const pageStartTime = Date.now();

const userDocRef = doc(db, "users", username);

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