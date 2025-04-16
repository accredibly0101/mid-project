import { db } from '/firebase/config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

let player;
let currentVideoTitle = "";
let watchStartTime = 0;

function onYouTubeIframeAPIReady() {
    console.log("✅ Iframe API 已加載");
    player = new YT.Player("player", {
        height: "360",
        width: "640",
        videoId: "R5b3yt-bTL0",
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange
        }
    });
}

// ⛳ 關鍵：手動將函式掛到 window 上
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

// ✅ 點擊影片切換邏輯
document.querySelectorAll('.lesson-item').forEach(item => {
item.addEventListener('click', () => {
    const videoUrl = item.dataset.src;
    currentVideoTitle = item.textContent.trim();

    const urlObj = new URL(videoUrl);
    const videoId = urlObj.pathname.split("/").pop().split("?")[0];

    if (player && typeof player.loadVideoById === 'function') {
    player.loadVideoById({ videoId, startSeconds: 0 });
    console.log(`🎬 切換至：${currentVideoTitle}`);
    } else {
    console.warn("⚠️ Player 尚未就緒");
    }
});
});

function onPlayerStateChange(event) {
const state = event.data;

if (state === YT.PlayerState.PLAYING) {
    watchStartTime = Date.now();
    console.log("▶️ 播放開始");
    } else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) {
    const watchTime = Math.floor((Date.now() - watchStartTime) / 1000);
    const isEnded = state === YT.PlayerState.ENDED;
    saveWatchData(watchTime, isEnded);
    console.log(`⏹️ 播放暫停/結束，觀看秒數：${watchTime}`);
}
}

function saveWatchData(watchTime, finished) {
    addDoc(collection(db, "video_tracking"), {
    userId: "anonymous",
    videoTitle: currentVideoTitle,
    watchTime: watchTime,
    completed: finished,
    timestamp: serverTimestamp()
    }).then(() => {
    console.log("✅ 已儲存觀看數據");
    }).catch(err => {
    console.error("❌ 儲存錯誤：", err);
});
}
