import { db } from './config.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

window.addEventListener("DOMContentLoaded", async () => {
const username = localStorage.getItem("user");
const userRef = doc(db, "mid-users", username);
const today = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).replaceAll('/', '-');  // 例如 "2025-06-29"


try {
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    /*** ✅ 功能一：跨日登入紀錄與提示 ***/
    const loginDates = userData.loginDates || {};
    if (!loginDates[today]) {
    loginDates[today] = true;
    await updateDoc(userRef, { loginDates });
    console.log(`✅ 登入記錄已新增 ${today}`);
    }

    const totalLoginDays = Object.keys(loginDates).length;
    const loginMsg = document.getElementById("loginRewardMsg");
    if (loginMsg && totalLoginDays >= 2) {
    loginMsg.innerText = `已連續登入 ${totalLoginDays} 天！`;
    }

    // /*** ✅ 功能二：今日影片完成數提示 ***/
    // const videos = userData.videos || {};
    // const lastUpdate = userData.lastUpdate?.toDate?.();
    // const todayStr = today;
    // let isToday = false;

    // if (lastUpdate) {
    // const lastStr = lastUpdate.toISOString().split('T')[0];
    // isToday = (lastStr === todayStr);
    // }

    // let watchedCount = 0;
    // for (const videoId in videos) {
    // const v = videos[videoId];
    // if (v.percentWatched >= 80) watchedCount++;
    // }

    // const statusMsg = document.getElementById("todayStatusMsg");
    // if (statusMsg) {
    // if (!isToday) {
    //     statusMsg.innerText = "今日尚未觀看任何影片";
    // } else {
    //     statusMsg.innerText = `今日已完成 ${watchedCount} 部影片，加油！`;
    // }
    // }
} catch (e) {
    console.error("❌ 發生錯誤：", e);
}
});
