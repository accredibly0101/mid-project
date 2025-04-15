import { db } from "/firebase/config.js";
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

let player;
let currentVideoTitle = "";
let watchStartTime = null;

// 🎬 YouTube Iframe API callback
window.onYouTubeIframeAPIReady = function () {
player = new YT.Player("player", {
    height: "360",
    width: "640",
    videoId: "", // 初始無影片
    events: {
    onStateChange: onPlayerStateChange,
    },
});
};

// 🎥 處理播放事件
function onPlayerStateChange(event) {
const playerState = event.data;

if (playerState === YT.PlayerState.PLAYING) {
    watchStartTime = Date.now();
}

if (playerState === YT.PlayerState.PAUSED || playerState === YT.PlayerState.ENDED) {
    if (watchStartTime) {
    const watchedSeconds = Math.floor((Date.now() - watchStartTime) / 1000);
    saveVideoLog(currentVideoTitle, watchedSeconds, playerState === YT.PlayerState.ENDED);
    watchStartTime = null;
    }
}
}

// 📝 將觀看資料記錄進 Firestore
async function saveVideoLog(title, duration, isFinished) {
try {
    await addDoc(collection(db, "videoLogs"), {
    title: title,
    watchedSeconds: duration,
    isFinished: isFinished,
    timestamp: serverTimestamp(),
    userId: "anonymous", // 未來可改為 Firebase Auth 使用者 ID
    });
    console.log(`✅ 記錄影片「${title}」成功`);
} catch (error) {
    console.error("❌ 儲存失敗", error);
}
}

// 🎯 點擊課程清單來切換影片
document.querySelectorAll(".lesson-item").forEach(item => {
item.addEventListener("click", () => {
    const url = item.dataset.src;
    const videoId = getYouTubeVideoId(url);
    currentVideoTitle = item.textContent.trim();

    if (player && videoId) {
    player.loadVideoById(videoId);
    }
});
});

// 🧠 從 URL 擷取 YouTube Video ID
function getYouTubeVideoId(url) {
const match = url.match(/\/embed\/([^?]+)/);
return match ? match[1] : null;
}