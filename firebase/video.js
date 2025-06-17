import { db, getUsername } from './config.js';
import {doc, getDoc, setDoc, serverTimestamp} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// 使用者名稱
const username = getUsername();
// const username = "anonymous";
const userRef = doc(db, "mid_users", username);

// 2️⃣ YouTube Player 設定
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, null);

let player;
let sessionStartTime = null;
let videoDuration = 0;
let currentVideoId = "";
let currentVideoTitle = "";

// YouTube 影片準備好時
window.onYouTubeIframeAPIReady = function () {
player = new YT.Player('player', {
height: '250px',
width: '100%',
videoId: '',
playerVars: {
    controls: 1,
    fs: 1,
    iv_load_policy: 3,
    rel: 0,
    modestbranding: 1,
    playsinline: 1
},
events: {
    'onReady': onPlayerReady,
    'onStateChange': onPlayerStateChange
}
});
};

function onPlayerReady(event) {
console.log('✅ YouTube Player Ready');
}


// 3️⃣ 播放狀態變更處理
function onPlayerStateChange(event) {
if (event.data === YT.PlayerState.PLAYING) {
    sessionStartTime = Date.now();
    videoDuration = player.getDuration();

    currentVideoId = player.getVideoData().video_id;
    currentVideoTitle = player.getVideoData().title;

    console.log(`🎬 Playing: ${currentVideoTitle}`);
}

if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
    if (sessionStartTime) {
    const endTime = Date.now();
    const watchTime = Math.floor((endTime - sessionStartTime) / 1000);

    saveVideoData(watchTime);
    sessionStartTime = null;
    }
}
}

// 4️⃣ 儲存影片資料至 Firestore
async function saveVideoData(watchTime) {
try {
    const docSnap = await getDoc(userRef);
    let data = docSnap.exists() ? docSnap.data() : {};

    if (!data.videos) data.videos = {};
    if (!data.videos[currentVideoId]) {
    data.videos[currentVideoId] = {
        title: currentVideoTitle || player.getVideoData().title || "未知標題",
        duration: 0,
        completed: false
    };
    } else {
    // 補標題
    if (!data.videos[currentVideoId].title || data.videos[currentVideoId].title === "") {
        data.videos[currentVideoId].title = currentVideoTitle || player.getVideoData().title || "未知標題";
        console.log(`🔁 已補上影片標題：${data.videos[currentVideoId].title}`);
    }
    }

    // 🧠 加總但不超過總長度
    const previousDuration = data.videos[currentVideoId].duration || 0;
    const newDuration = previousDuration + watchTime;
    const cappedDuration = Math.min(newDuration, videoDuration);

    data.videos[currentVideoId].duration = cappedDuration;
    data.videos[currentVideoId].percentWatched = Math.round((cappedDuration / videoDuration) * 100);


    // ✅ 若超過 80%，就算完成
    const percentWatched = cappedDuration / videoDuration;
    if (percentWatched >= 0.8) {
    data.videos[currentVideoId].completed = true;
    }

    data.lastUpdate = serverTimestamp();

    await setDoc(userRef, { videos: data.videos, lastUpdate: data.lastUpdate }, { merge: true });
    updateLessonProgressUI(); 
    console.log("✅ 影片紀錄完成：", currentVideoId, cappedDuration, data.videos[currentVideoId].completed);
    } catch (e) {
        console.error("❌ 儲存影片紀錄失敗：", e);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    updateLessonProgressUI();

    // 👉 優先從 localStorage 讀取資料
    const lessonName = localStorage.getItem("selectedLesson");
    const videoIdFromStorage = localStorage.getItem("selectedVideoId");

    console.log("Lesson Name: ", lessonName);
    console.log("Video ID: ", videoIdFromStorage);

    const lessonItems = document.querySelectorAll(".lesson-item");
    const videoTitle = document.querySelector(".video-title");

    function waitForPlayerReady(callback) {
        if (player && typeof player.loadVideoById === "function") {
            console.log("✅ YouTube Player Ready");
            callback();
        } else {
            console.log("⌛ Player is not ready yet.");
            setTimeout(() => waitForPlayerReady(callback), 100);
        }
    }

    waitForPlayerReady(() => {
        if (videoIdFromStorage) {
            player.loadVideoById(videoIdFromStorage);
            if (lessonName) {
                videoTitle.textContent = lessonName;
            }

            lessonItems.forEach(item => {
                const itemText = item.textContent.trim();
                if (itemText === lessonName) {
                    item.classList.add("active");
                    const parentItems = item.closest(".lesson-items");
                    if (parentItems) {
                        parentItems.style.display = "block";
                    }
                }
            });

            // ❌ 載入後清除 localStorage（避免干擾下一次跳轉）
            localStorage.removeItem("selectedLesson");
            localStorage.removeItem("selectedVideoId");

        } else {
            // 若 localStorage 無資料，載入預設第一個影片
            if (lessonItems.length > 0) {
                const firstItem = lessonItems[0];
                const firstVideoId = extractVideoId(firstItem.getAttribute("data-src"));
                if (firstVideoId) player.loadVideoById(firstVideoId);
                videoTitle.textContent = firstItem.textContent.trim();
                firstItem.classList.add("active");
            }
        }
    });

    // 點擊課程項目時載入影片
    lessonItems.forEach(item => {
        item.addEventListener("click", function () {
            const newVideoId = extractVideoId(this.getAttribute("data-src"));
            if (newVideoId) {
                player.loadVideoById(newVideoId);
                videoTitle.textContent = this.textContent.trim();
                lessonItems.forEach(i => i.classList.remove("active"));
                this.classList.add("active");
            }
        });
    });
});

function extractVideoId(url) {
    const match = url.match(/\/embed\/([^\?]+)/);
    return match ? match[1] : null;
}


let lastPlayedTime = 0; // 記錄影片上次播放的時間

// 當頁面焦點變動時（例如切換分頁、最小化）
document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
        // 當頁面不再可見時，暫停影片並記錄當前時間
        if (player && typeof player.getCurrentTime === "function") {
            lastPlayedTime = player.getCurrentTime(); // 記錄當前播放時間
            player.pauseVideo(); // 暫停影片
        }
    } else if (document.visibilityState === "visible") {
        // 當頁面恢復可見時，繼續播放影片從上次播放的時間
        if (player && typeof player.seekTo === "function" && lastPlayedTime > 0) {
            player.seekTo(lastPlayedTime); // 從上次記錄的時間繼續播放
            player.playVideo(); // 播放影片
        }
    }
});
