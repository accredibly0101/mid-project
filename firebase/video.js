
import { db } from './config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";


// 連接youtube api並建立播放器
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player; // 宣告為全域變數
// 建立播放器
window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
        height: '250px',
        width: '100%',
        videoId: 'R5b3yt-bTL0',
        playerVars: {
            'controls': 1,
            'fs': 1,
            'iv_load_policy': 3,
            'rel': 0,
            'modestbranding': 1,
            'playsinline': 0
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
};


// 測試用的簡單處理事件（可暫時加上）
function onPlayerReady(event) {
console.log('Player is ready');
}

let sessionStartTime = null;
function onPlayerStateChange(event) {
    const videoId = player.getVideoData().video_id;
    const videoTitle = player.getVideoData().title;

    // 播放開始
    if (event.data === YT.PlayerState.PLAYING) {
        sessionStartTime = Date.now(); // 記錄開始時間
    }

    // 播放結束 or 暫停
    if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
        if (sessionStartTime) {
            const sessionEndTime = Date.now();
            const duration = Math.floor((sessionEndTime - sessionStartTime) / 1000); // 秒

            // 儲存到 Firestore
            saveWatchDataToFirestore(videoId, videoTitle, duration);

            sessionStartTime = null; // 重設時間
        }
    }
}

async function saveWatchDataToFirestore(videoId, videoTitle, duration) {
    try {
        const watchData = {
            videoId,
            videoTitle,
            duration,
            timestamp: serverTimestamp(),
            user: 'anonymous' // 目前先匿名紀錄
        };

        await addDoc(collection(db, "video_watch_logs_test"), watchData);
        console.log("✅數據儲存:", watchData);
    } catch (e) {
        console.error("❌數據儲存失敗:", e);
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

