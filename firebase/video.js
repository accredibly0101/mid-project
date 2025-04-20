import { db } from './config.js';
import {doc, getDoc, setDoc, serverTimestamp} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// 使用者名稱
const username = "anonymous";
const pageName = window.location.pathname.split('/').pop(); // course_video.html
const userRef = doc(db, "users", username);

// 1️⃣ 頁面停留時間紀錄
let pageStartTime = Date.now();
window.addEventListener('beforeunload', async () => {
const pageEndTime = Date.now();
const pageDuration = Math.floor((pageEndTime - pageStartTime) / 1000); // 秒

try {
const docSnap = await getDoc(userRef);
let data = docSnap.exists() ? docSnap.data() : {};

if (!data.pageTimes) data.pageTimes = {};
if (!data.pageTimes[pageName]) data.pageTimes[pageName] = 0;

data.pageTimes[pageName] += pageDuration;
data.lastUpdate = serverTimestamp();

await setDoc(userRef, data);
console.log(`✅ 頁面停留紀錄完成：${pageName} 停留 ${pageDuration} 秒`);
} catch (e) {
console.error("❌ 頁面停留儲存失敗", e);
}
});

// 2️⃣ YouTube Player 設定
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, null);

let player;
let sessionStartTime = null;
let videoDuration = 0;
let videoCompleted = false;
let currentVideoId = "";
let currentVideoTitle = "";

// YouTube 影片準備好時
window.onYouTubeIframeAPIReady = function () {
player = new YT.Player('player', {
height: '250px',
width: '100%',
videoId: 'R5b3yt-bTL0',
playerVars: {
    controls: 1,
    fs: 1,
    iv_load_policy: 3,
    rel: 0,
    modestbranding: 1,
    playsinline: 0
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
currentVideoId = player.getVideoData().video_id;
currentVideoTitle = player.getVideoData().title;

if (event.data === YT.PlayerState.PLAYING) {
sessionStartTime = Date.now();
videoDuration = player.getDuration(); // 總長
}

if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
if (sessionStartTime) {
    const endTime = Date.now();
    const watchTime = Math.floor((endTime - sessionStartTime) / 1000);
    const percentWatched = watchTime / videoDuration;

    videoCompleted = percentWatched >= 0.9;

    saveVideoData(watchTime, videoCompleted);

    sessionStartTime = null;
}
}
}

// 4️⃣ 儲存影片資料至 Firestore
async function saveVideoData(watchTime, completed) {
try {
const docSnap = await getDoc(userRef);
let data = docSnap.exists() ? docSnap.data() : {};

if (!data.videos) data.videos = {};
if (!data.videos[currentVideoId]) {
    data.videos[currentVideoId] = {
    title: currentVideoTitle,
    duration: 0,
    completed: false
    };
}

data.videos[currentVideoId].duration += watchTime;
if (completed) data.videos[currentVideoId].completed = true;
data.lastUpdate = serverTimestamp();

await setDoc(userRef, data);
console.log("✅ 影片紀錄完成：", currentVideoId, watchTime, completed);
} catch (e) {
console.error("❌ 儲存影片紀錄失敗：", e);
}
}



document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonName = urlParams.get("lesson");

    const lessonItems = document.querySelectorAll(".lesson-item");
    const videoTitle = document.querySelector(".video-title");

    // 等待 YouTube Player 初始化完畢再繼續操作
    function waitForPlayerReady(callback) {
        if (player && typeof player.loadVideoById === "function") {
            callback();  // 播放器已經準備好，執行回調
        } else {
            setTimeout(() => waitForPlayerReady(callback), 100);  // 每 100ms 檢查一次
        }
    }
    
    

    // 輔助函式：從 data-src 中擷取 videoId（只要 ID）
    function extractVideoId(url) {
        const match = url.match(/\/embed\/([^\?]+)/);
        return match ? match[1] : null;
    }

    // 1️⃣ 根據 URL 參數預設載入影片
    waitForPlayerReady(() => {
        lessonItems.forEach(item => {
            if (lessonName && item.textContent.trim() === lessonName) {
                item.classList.add("active");
                videoTitle.textContent = lessonName;
                const videoId = extractVideoId(item.getAttribute("data-src"));
                if (videoId) player.loadVideoById(videoId);

                // 展開課程單元
                let parentItems = item.closest(".lesson-items");
                if (parentItems) {
                    parentItems.style.display = "block";
                }
            }
        });
    });

    // 2️⃣ 點擊切換影片
    lessonItems.forEach(item => {
        item.addEventListener("click", function (event) {
            event.preventDefault(); // 防止跳轉
    
            // 移除所有 active
            lessonItems.forEach(i => i.classList.remove("active"));
    
            // 設定當前 active + 顯示標題
            this.classList.add("active");
            videoTitle.textContent = this.textContent.trim();
    
            const videoId = extractVideoId(this.getAttribute("data-src"));
    
            // 確保 YouTube 播放器已準備好
            waitForPlayerReady(() => {
                if (videoId) {
                    player.loadVideoById(videoId);
                }
            });
        });
    });
    
    

    // 課程清單收合
// 課程清單收合
document.querySelectorAll(".lesson-header").forEach(header => {
    header.addEventListener("click", function () {
        const currentItems = this.nextElementSibling;
    
        // 收起所有 lesson-items
        document.querySelectorAll(".lesson-items").forEach(items => {
            if (items !== currentItems) {
                items.style.display = "none";
            }
        });
    
        // 切換目前這一個
        currentItems.style.display = currentItems.style.display === "block" ? "none" : "block";
    });
});
})


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

