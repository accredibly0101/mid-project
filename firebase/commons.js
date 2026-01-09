import { db, auth } from "./config.js";
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { onAuthStateChanged} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

const announcementsContainer = document.getElementById("announcements-container");

//是否有登入？
onAuthStateChanged(auth, user => {
    if (!user) {
        // 沒登入 ➜ 導回首頁（或登入頁）
        // alert(`請先登入後再進行學習`);
        window.location.href = "mid_login.html";
    }
});


// 課程清單依照日期解鎖
import { loadReleaseConfig, isUnitOpen, setLocked, showLockedMessage, getNowInTaipei } from "./releaseGate.js";

(async function initReleaseGate() {
const releaseConfig = await loadReleaseConfig();
const now = getNowInTaipei();
console.log("nowTaipei", now.toISOString());

document.querySelectorAll(".lesson-container[data-unit]").forEach(container => {
    const unitKey = container.dataset.unit;
    const open = isUnitOpen(releaseConfig, unitKey, now);

    // 鎖整個單元視覺
    setLocked(container, !open);

    // ✅ 同時鎖 a 與 div（課程頁 / 影片頁都吃到）
    container.querySelectorAll(".lesson-item").forEach(item => {
    if (!open) {
        item.addEventListener(
        "click",
        (e) => {
            // ✅ 先攔截，避免你的「切換影片」程式繼續跑
            e.preventDefault?.();
            e.stopPropagation();
            e.stopImmediatePropagation?.();

            showLockedMessage(`「${container.querySelector(".lesson-header")?.textContent}」尚未開放`);
        },
        { capture: true } // ⭐ 關鍵：先攔截
        );
    }
    });
});
})();


// 讀取公告
async function loadAnnouncements() {
    try {
        const q = query(collection(db, "mid_announcements"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        announcementsContainer.innerHTML = ""; // 先清空舊的內容
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const timestamp = data.timestamp ? data.timestamp.toDate() : new Date();

            const announcementHTML = `
                <div class="announcement-card">
                    <h3>${data.title}</h3>
                    <p>${data.content}</p>
                    <span class="timestamp">${timestamp.toLocaleString()}</span>
                </div>
            `;
            announcementsContainer.innerHTML += announcementHTML;
        });

        console.log("✅ 成功載入公告，共有", querySnapshot.size, "筆");
    } catch (error) {
        console.error("❌ 無法載入公告:", error);
    }
}

// ✅ 直接執行（避免 `DOMContentLoaded` 問題）
loadAnnouncements();

const infoButton = document.querySelector(".info-button");

// 點擊按鈕顯示或隱藏
infoButton.addEventListener("click", (event) => {
    event.stopPropagation(); // 避免點按按鈕時被 document 監聽
    announcementsContainer.style.display =
        announcementsContainer.style.display === "block" ? "none" : "block";
});

// 點擊視窗外部就隱藏公告
document.addEventListener("click", (event) => {
    const isClickInside = announcementsContainer.contains(event.target) || infoButton.contains(event.target);
    if (!isClickInside) {
        announcementsContainer.style.display = "none";
    }
});

//使用者名稱全站常駐
        document.addEventListener("DOMContentLoaded", function () {
        const name = localStorage.getItem("displayName") || "使用者";
        const userInfo = document.getElementById("userInfo");
        if (userInfo) {
        userInfo.textContent = `${name} 同學`;
        } else {
        console.warn("找不到 #userInfo 元素");
        }
    });

//登出按鈕
    document.getElementById("logout-btn").addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "mid_login.html";
    });


import { createPageTimeTracker } from "./pageTimeTracker.js";

const tracker = createPageTimeTracker({
    collection: "mid-users",
    flushEverySeconds: 5,
    maxTickSeconds: 30,           // 防爆：每次 tick 最多補 30 秒
    maxPendingFlushSeconds: 300,  // 防爆：一次寫入最多 300 秒
    debug: false                  // 先開 debug 看 log
});

tracker.start();

