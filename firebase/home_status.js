// home_status.js
import { db, auth } from './config.js';
import {
doc,
getDoc,
updateDoc
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';
import {
onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';

window.addEventListener("DOMContentLoaded", () => {
onAuthStateChanged(auth, async (user) => {
    if (!user) {
    console.warn("⚠️ 尚未登入，home_status 停止執行");
    return;
    }

    /** 🔑 用 Auth uid 當 docId */
    const userRef = doc(db, "mid-users", user.uid);

    /** 📅 台灣格式日期（YYYY-MM-DD） */
    const today = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
    }).replaceAll('/', '-');

    try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        console.error("❌ 找不到使用者文件：", userRef.path);
        return;
    }

    const userData = userSnap.data();

    /* ===============================
        ✅ 功能一：跨日登入紀錄
    =============================== */
    const loginDates = userData.loginDates || {};

    if (!loginDates[today]) {
        loginDates[today] = true;
        await updateDoc(userRef, { loginDates });
        console.log(`✅ 登入記錄已新增 ${today}`);
    }

    const totalLoginDays = Object.keys(loginDates).length;
    const loginMsg = document.getElementById("loginRewardMsg");
    if (loginMsg) {
        loginMsg.innerText = `總登入天數：${totalLoginDays} 天`;
    }

    /* ===============================
        ✅ 功能二：影片完成總數
    =============================== */
    const videos = userData.videos || {};
    let watchedCount = 0;

    for (const videoId in videos) {
        const v = videos[videoId];
        if (v?.percentWatched >= 80) watchedCount++;
    }

    const statusMsg = document.getElementById("todayStatusMsg");
    if (statusMsg) {
        statusMsg.innerText = `完成觀看影片總數：${watchedCount} 部`;
    }

    } catch (e) {
    console.error("❌ home_status 發生錯誤：", e);
    }
});
});
