import { db, getUsername } from './config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

window.addEventListener('DOMContentLoaded', () => {
    // 收合功能
    document.querySelectorAll('.lesson-header').forEach(header => {
        header.addEventListener('click', () => {
            const items = header.nextElementSibling;
            items.style.display = items.style.display === 'block' ? 'none' : 'block';
        });
    });

    updateLessonProgressUI();
});


export async function updateLessonProgressUI() {
    const username = getUsername();
    const userRef = doc(db, "mid_users", username);

    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const videos = data.videos || {};

    const lessonItems = document.querySelectorAll(".lesson-item");

    lessonItems.forEach(item => {
        let videoId = null;

        if (item.dataset.src) {
            // ➔ course_video.html：從 data-src 裡解析
            try {
                const url = new URL(item.dataset.src);
                videoId = url.pathname.split("/")[2]; // e.g., "R5b3yt-bTL0"
            } catch (e) {
                console.error("Invalid data-src URL:", item.dataset.src);
            }
        } else if (item.href) {
            // ➔ course_info.html：從 href 裡解析
            try {
                const url = new URL(item.href, window.location.origin);
                const lessonParam = url.searchParams.get('lesson');
                if (lessonParam) {
                    videoId = lessonParam.split(" ")[0]; // e.g., "1-1"
                }
            } catch (e) {
                console.error("Invalid href URL:", item.href);
            }
        }

        if (!videoId) return; // 找不到 id 就跳過

        const info = videos[videoId];
        const percent = (info && info.percentWatched !== undefined) ? info.percentWatched : 0;

        // 避免重複加上 percent
        if (item.querySelector(".progress-percent")) return;

        const percentTag = document.createElement("span");
        percentTag.className = "progress-percent";
        percentTag.textContent = `${percent}%`;
        percentTag.style.fontSize = "0.85em";
        percentTag.style.color = percent >= 80 ? "#5271ff" : "#888f96";
        percentTag.style.fontWeight = percent >= 80 ? "700" : "600";
        percentTag.style.position = "absolute";
        percentTag.style.right = "10px";
        percentTag.style.top = "50%";
        percentTag.style.transform = "translateY(-50%)";

        item.style.position = "relative";
        item.appendChild(percentTag);
        
        // 建立百分比UI(圖形)
    //     const progressWrapper = document.createElement("div");
    //     progressWrapper.className = "circle-progress";
    //     progressWrapper.innerHTML = `
    //     <svg viewBox="0 0 36 36" class="circular-chart ${percent >= 80 ? 'green' : '#439cfb'}">
    //     <path class="circle-bg"
    //             d="M18 2.0845
    //                 a 15.9155 15.9155 0 0 1 0 31.831
    //                 a 15.9155 15.9155 0 0 1 0 -31.831"/>
    //     <path class="circle"
    //             stroke-dasharray="${percent}, 100"
    //             d="M18 2.0845
    //                 a 15.9155 15.9155 0 0 1 0 31.831
    //                 a 15.9155 15.9155 0 0 1 0 -31.831"/>
    //     </svg>
    // `;

        // progressWrapper.style.position = "absolute";
        // progressWrapper.style.right = "10px";
        // progressWrapper.style.top = "50%";
        // progressWrapper.style.transform = "translateY(-50%)";
        // item.style.position = "relative";
        // item.appendChild(progressWrapper);

    });
}

// 讓它可以在 module 外呼叫
window.updateLessonProgressUI = updateLessonProgressUI;
