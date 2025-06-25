import { db, getUsername } from './config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.lesson-header').forEach(header => {
        header.addEventListener('click', () => {
            const items = header.nextElementSibling;
            items.style.display = items.style.display === 'block' ? 'none' : 'block';
        });
    });

    // 若使用 Firebase Auth，應搭配 onAuthStateChanged
    updateLessonProgressUI(); 
});

export async function updateLessonProgressUI() {
    const username = getUsername();
    if (!username) return;

    const userRef = doc(db, "mid-users", username);
    const docSnap = await getDoc(userRef, { source: 'server' }); // 避免讀到舊資料

    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const videos = data.videos || {};

    const lessonItems = document.querySelectorAll(".lesson-item");

    lessonItems.forEach(item => {
        let videoId = null;

        if (item.dataset.src) {
            try {
                const url = new URL(item.dataset.src);
                videoId = url.pathname.split("/")[2];
            } catch (e) {
                console.error("Invalid data-src URL:", item.dataset.src);
            }
        } else if (item.href) {
            try {
                const url = new URL(item.href, window.location.origin);
                const lessonParam = url.searchParams.get('lesson');
                if (lessonParam) {
                    videoId = lessonParam.split(" ")[0];
                }
            } catch (e) {
                console.error("Invalid href URL:", item.href);
            }
        }

        if (!videoId) return;

        const info = videos[videoId];
        const percent = (info && info.percentWatched !== undefined) ? info.percentWatched : 0;

        // 先移除再建立
        const oldPercent = item.querySelector(".progress-percent");
        if (oldPercent) oldPercent.remove();

        const percentTag = document.createElement("span");
        percentTag.className = "progress-percent";
        percentTag.textContent = `${percent}%`;
        percentTag.style.cssText = `
            font-size: 0.85em;
            color: ${percent >= 80 ? '#5271ff' : '#888f96'};
            font-weight: ${percent >= 80 ? '700' : '600'};
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
        `;

        item.style.position = "relative";
        item.appendChild(percentTag);
    });
}


// 讓它可以在 module 外呼叫
window.updateLessonProgressUI = updateLessonProgressUI;
