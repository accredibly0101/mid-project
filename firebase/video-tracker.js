// video-tracker.js
import { db } from './firebase/config.js';

let player;
let watchTimer = null;
let watchedSeconds = 0;
let videoStartTime = null;
let currentTitle = null;
let currentVideoId = null;
let eventLog = [];
let userId = `anonymous_${Math.random().toString(36).substring(2, 8)}`;

// 動態載入 YouTube Iframe API
function loadYouTubeAPI() {
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);
}

// 建立播放器
function createPlayer(videoId) {
if (player) {
player.destroy();
}

const playerDiv = document.createElement("div");
playerDiv.id = "player";
document.getElementById("video-wrapper").innerHTML = "";
document.getElementById("video-wrapper").appendChild(playerDiv);

player = new YT.Player('player', {
    height: '360',
    width: '640',
    videoId,
    events: {
    'onReady': onPlayerReady,
    'onStateChange': onPlayerStateChange
    }
});
}

function onPlayerReady(event) {
videoStartTime = new Date().toISOString();
watchedSeconds = 0;
eventLog = [];
}

function onPlayerStateChange(event) {
const state = event.data;

if (state === YT.PlayerState.PLAYING) {
    startTimer();
    logEvent("play");
} else if (state === YT.PlayerState.PAUSED) {
    stopTimer();
    logEvent("pause");
} else if (state === YT.PlayerState.ENDED) {
    stopTimer();
    logEvent("end");
    saveData(true);
}
}

function startTimer() {
if (!watchTimer) {
    watchTimer = setInterval(() => {
    watchedSeconds++;
    }, 1000);
}
}

function stopTimer() {
clearInterval(watchTimer);
watchTimer = null;
}

function logEvent(type) {
eventLog.push({
    type,
    timestamp: new Date().toISOString()
});
}

function saveData(isCompleted = false) {
if (!currentVideoId || !currentTitle) return;

const payload = {
    userId,
    videoId: currentVideoId,
    videoTitle: currentTitle,
    startedAt: videoStartTime,
    lastWatchedAt: new Date().toISOString(),
    watchedSeconds,
    isCompleted,
    events: eventLog
};

db.collection("videoTracking")
    .add(payload)
    .then(() => console.log("✅ 已記錄：", currentTitle))
    .catch((err) => console.error("❌ 儲存錯誤:", err));
}

// 點擊課程列表載入影片
function bindLessonClick() {
const lessonItems = document.querySelectorAll(".lesson-item");

lessonItems.forEach((item) => {
    item.addEventListener("click", () => {
    const url = item.dataset.src;
    const title = item.innerText;
    const videoId = extractYouTubeVideoId(url);

    // 若有影片在播放中，先儲存
    if (player && currentVideoId !== videoId) {
        saveData(false);
    }

    currentVideoId = videoId;
    currentTitle = title;

    createPlayer(videoId);
    });
});
}

// 從 YouTube URL 取得影片 ID
function extractYouTubeVideoId(url) {
const match = url.match(/[?&]v=([^&#]*)|\/embed\/([^?&#]*)/);
return match[1] || match[2];
}

window.addEventListener("DOMContentLoaded", () => {
loadYouTubeAPI();
bindLessonClick();
});

// 頁面離開前儲存最後觀看進度
window.addEventListener("beforeunload", () => {
saveData(false);
});
