import { db } from "/firebase/config.js";
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const announcementsContainer = document.getElementById("announcements-container");

// 讀取公告
async function loadAnnouncements() {
    try {
        const q = query(collection(db, "announcements"), orderBy("timestamp", "desc"));
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
