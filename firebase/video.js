import { loadReleaseConfig, isUnitOpen, showLockedMessage, getNowInTaipei } from "./releaseGate.js";
import { videoToUnit } from "./videoMap.js";

import { db, getUsername } from "./config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

/* ---------------------------
工具：取得純標題文字（排除進度 UI）
---------------------------- */
function getLessonTitleOnly(el) {
if (!el) return "";
const clone = el.cloneNode(true);
clone.querySelectorAll(".progress-percent, .circle-progress, .bar-progress, .bar-text")
    .forEach(n => n.remove());
return clone.textContent.trim();
}

/* ---------------------------
工具：從 data-src 抽 videoId
---------------------------- */
function extractVideoId(url) {
if (!url) return null;
const match = url.match(/\/embed\/([^\?]+)/);
return match ? match[1] : null;
}

/* ---------------------------
防偷跑（保留你的邏輯）
---------------------------- */
(async function guardDirectAccess() {
const releaseConfig = await loadReleaseConfig();
const now = getNowInTaipei();

const videoId = localStorage.getItem("currentVideoId");
if (!videoId) return;

const unitKey = videoToUnit[videoId];
if (!unitKey) {
    showLockedMessage("此影片不存在或尚未開放");
    window.location.replace("mid-index.html");
    return;
}

const open = isUnitOpen(releaseConfig, unitKey, now);
if (!open) {
    showLockedMessage("此影片尚未開放");

    localStorage.removeItem("currentVideoId");
    localStorage.removeItem("currentVideoTitle");

    window.location.replace("mid-video.html");
    return;
}
})();

/* ---------------------------
續播提示文字
---------------------------- */
function formatTime(seconds) {
seconds = Math.max(0, Math.floor(seconds || 0));
const h = Math.floor(seconds / 3600);
const m = Math.floor((seconds % 3600) / 60);
const s = seconds % 60;

const mm = String(m).padStart(2, "0");
const ss = String(s).padStart(2, "0");

if (h > 0) return `${h}:${mm}:${ss}`;
return `${mm}:${ss}`;
}

function setResumeHint(seconds) {
const el = document.getElementById("resume-hint");
if (!el) return;

if (seconds && seconds >= 5) {
    el.textContent = `已跳回上次觀看紀錄：${formatTime(seconds)}`;
} else {
    el.textContent = ``;
}
}

/* ---------------------------
Firestore 參考
---------------------------- */
const username = getUsername();
const userRef = doc(db, "mid-users", username || "anonymous");

/* =========================
✅ 續播（localStorage）設定
========================= */
const RESUME_KEY = "resumePositions_v1";
const resumeMemCache = {}; // 記憶體快取

function loadResumeMap() {
try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) || "{}");
} catch {
    return {};
}
}

function saveResumePositionLocal(videoId, seconds) {
if (!videoId || typeof seconds !== "number") return;
if (!Number.isFinite(seconds) || seconds < 0) return;

resumeMemCache[videoId] = seconds;
const map = loadResumeMap();
map[videoId] = seconds;
localStorage.setItem(RESUME_KEY, JSON.stringify(map));
}

function getResumePositionLocal(videoId) {
if (!videoId) return 0;

if (typeof resumeMemCache[videoId] === "number") return resumeMemCache[videoId];

const map = loadResumeMap();
const v = map[videoId];
if (typeof v === "number") {
    resumeMemCache[videoId] = v;
    return v;
}
return 0;
}

/* ---------------------------
Firestore 讀取 lastPosition（備援）
---------------------------- */
async function getResumePositionRemote(videoId) {
try {
    if (!username || !videoId) return 0;

    const snap = await getDoc(userRef, { source: "server" });
    if (!snap.exists()) return 0;

    const pos = snap.data()?.videos?.[videoId]?.lastPosition;
    if (typeof pos === "number") {
    resumeMemCache[videoId] = pos;
    return pos;
    }
} catch (e) {
    console.error("❌ 讀取 Firestore lastPosition 失敗：", e);
}
return 0;
}

/* ---------------------------
✅ 統一載入（只跳不播）
---------------------------- */
async function loadWithResume(videoId) {
let pos = getResumePositionLocal(videoId);
if (pos < 5) pos = await getResumePositionRemote(videoId);
if (pos < 5) pos = 0;

setResumeHint(pos);

// 用 startSeconds 載入
player.loadVideoById({ videoId, startSeconds: pos });
}

/* =========================
YouTube Player 設定
========================= */
var tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.getElementsByTagName("script")[0].parentNode.insertBefore(tag, null);

let player;

// 當前影片資訊
let currentVideoId = "";
let currentVideoTitle = "";
let currentVideoDuration = 0;

// localStorage 心跳（續播）
let resumeTimer = null;

// 避免某些狀態抓不到 id
let lastStableVideoId = "";

/* ---------------------------
心跳：播放中每 2 秒存一次 localStorage 停點
---------------------------- */
function startResumeHeartbeat() {
stopResumeHeartbeat();
resumeTimer = setInterval(() => {
    try {
    if (!player || typeof player.getCurrentTime !== "function") return;
    const vid = player.getVideoData?.().video_id || currentVideoId || lastStableVideoId;
    if (!vid) return;

    const pos = Math.floor(player.getCurrentTime() || 0);
    if (pos > 0) saveResumePositionLocal(vid, pos);
    } catch {
    // 靜默
    }
}, 2000);
}

function stopResumeHeartbeat() {
if (resumeTimer) clearInterval(resumeTimer);
resumeTimer = null;
}

/* =========================
✅ 存影片資料到 Firestore
你要的規則：
- watchTimeTotal（duration）用差值法
- 每次 commit 最多 +20 秒（可快轉但防灌水）
- percentWatched = min(lastPosition/dur, duration/dur)
- completed = percentWatched >= 80
========================= */
async function saveVideoData({
videoId,
title,
positionSeconds,
durationSecondsSnapshot,
}) {
try {
    if (!username) return;
    if (!videoId) return;

    const docSnap = await getDoc(userRef);
    const data = docSnap.exists() ? docSnap.data() : {};
    const videos = data.videos || {};

    if (!videos[videoId]) {
    videos[videoId] = {
        title: title || "未知標題",

        // ✅ 研究用：累積有效觀看秒數（watchTimeTotal）
        duration: 0,

        // ✅ UI/後台一致的完成度
        percentWatched: 0,
        completed: false,

        // ✅ 續播用
        lastPosition: 0,

        // ✅ 差值法基準點
        lastCommitPosition: 0,
    };
    } else {
    if (!videos[videoId].title) videos[videoId].title = title || "未知標題";
    if (typeof videos[videoId].duration !== "number") videos[videoId].duration = 0;
    if (typeof videos[videoId].percentWatched !== "number") videos[videoId].percentWatched = 0;
    if (typeof videos[videoId].completed !== "boolean") videos[videoId].completed = false;
    if (typeof videos[videoId].lastPosition !== "number") videos[videoId].lastPosition = 0;
    if (typeof videos[videoId].lastCommitPosition !== "number") videos[videoId].lastCommitPosition = 0;
    }

    // 1) lastPosition（續播）
    const pos = (typeof positionSeconds === "number" && Number.isFinite(positionSeconds))
    ? Math.max(0, Math.floor(positionSeconds))
    : 0;

    videos[videoId].lastPosition = pos;
    videos[videoId].lastWatchedAt = serverTimestamp();

    // 同步 localStorage
    saveResumePositionLocal(videoId, pos);

    // 2) ✅ 差值法累積 watchTimeTotal（duration）
    const prevCommit = Math.max(0, Math.floor(videos[videoId].lastCommitPosition || 0));
    let delta = Math.max(0, pos - prevCommit);

    const MAX_ADD_PER_COMMIT = 20; // ✅ 你指定的規則
    if (delta > MAX_ADD_PER_COMMIT) delta = MAX_ADD_PER_COMMIT;

    // 更新基準點（避免下一次爆衝）
    videos[videoId].lastCommitPosition = pos;

    if (delta > 0) {
    videos[videoId].duration = (videos[videoId].duration || 0) + delta;
    }

    // 3) ✅ percent = min(lastPosition/dur, watchTimeTotal/dur)
    const dur = (typeof durationSecondsSnapshot === "number" && durationSecondsSnapshot > 0)
    ? durationSecondsSnapshot
    : 0;

    if (dur > 0) {
    const lastPosRatio = pos / dur;
    const watchRatio = (videos[videoId].duration || 0) / dur;

    const finalRatio = Math.min(lastPosRatio, watchRatio);
    const p = Math.round(Math.max(0, Math.min(1, finalRatio)) * 100);

    // 只往上（避免倒退觀看造成 % 掉下來）
    videos[videoId].percentWatched = Math.max(videos[videoId].percentWatched || 0, p);

    // completed 與 UI/後台一致
    if (videos[videoId].percentWatched >= 80) {
        videos[videoId].completed = true;
    }
    }

    // 台灣日期（保留你的欄位）
    const nowTW = new Date().toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    }).replaceAll("/", "-");

    await setDoc(
    userRef,
    {
        videos,
        lastUpdate: serverTimestamp(),
        lastUpdateDateTW: nowTW,
    },
    { merge: true }
    );

    // 更新目錄 UI（若有）
    if (typeof window.updateLessonProgressUI === "function") {
    window.updateLessonProgressUI();
    }
} catch (e) {
    console.error("❌ 儲存影片紀錄失敗：", e);
}
}

/* =========================
✅ 提交目前影片進度（切換/暫停/離開等時用）
========================= */
async function commitCurrentProgress(reason = "manual") {
try {
    if (!player) return;

    const vid = player.getVideoData?.().video_id || currentVideoId || lastStableVideoId;
    if (!vid) return;

    const pos = (typeof player.getCurrentTime === "function")
    ? Math.floor(player.getCurrentTime() || 0)
    : 0;

    const title = player.getVideoData?.().title || currentVideoTitle || "";

    const durSnap = (typeof player.getDuration === "function")
    ? (player.getDuration() || currentVideoDuration || 0)
    : (currentVideoDuration || 0);

    await saveVideoData({
    videoId: vid,
    title,
    positionSeconds: pos,
    durationSecondsSnapshot: durSnap,
    });
} catch (e) {
    console.error("❌ commitCurrentProgress 失敗：", e);
}
}

/* =========================
YouTube iframe 初始化
========================= */
window.onYouTubeIframeAPIReady = function () {
player = new YT.Player("player", {
    height: "250px",
    width: "100%",
    videoId: "",
    playerVars: {
    controls: 1,
    fs: 1,
    iv_load_policy: 3,
    rel: 0,
    modestbranding: 1,
    playsinline: 1,
    },
    events: {
    onReady: () => {
        console.log("✅ YouTube Player Ready");
    },
    onStateChange: onPlayerStateChange,
    },
});
};

function onPlayerStateChange(event) {
if (!player) return;

// PLAYING：更新影片資訊 + 開啟續播心跳
if (event.data === YT.PlayerState.PLAYING) {
    const vd = player.getVideoData?.() || {};
    currentVideoId = vd.video_id || currentVideoId;
    currentVideoTitle = vd.title || currentVideoTitle;

    if (currentVideoId) lastStableVideoId = currentVideoId;

    currentVideoDuration = (typeof player.getDuration === "function") ? (player.getDuration() || 0) : 0;

    startResumeHeartbeat();
}

// PAUSED / ENDED：停止心跳 + 提交一次
if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
    stopResumeHeartbeat();
    commitCurrentProgress(event.data === YT.PlayerState.PAUSED ? "pause" : "ended");
}
}

/* =========================
DOM：載入影片 / 清單切換（含續播）
========================= */
document.addEventListener("DOMContentLoaded", function () {
// 先更新一次目錄百分比 UI
if (typeof window.updateLessonProgressUI === "function") {
    window.updateLessonProgressUI();
}

const lessonName = localStorage.getItem("selectedLesson");
const videoIdFromStorage = localStorage.getItem("selectedVideoId");

const lessonItems = document.querySelectorAll(".lesson-item");
const videoTitleEl = document.querySelector(".video-title");

function waitForPlayerReady(callback) {
    if (player && typeof player.loadVideoById === "function") callback();
    else setTimeout(() => waitForPlayerReady(callback), 100);
}

function setActiveByElement(el) {
    lessonItems.forEach((i) => i.classList.remove("active"));
    if (el) el.classList.add("active");
}

function setActiveByLessonName(name) {
    lessonItems.forEach((item) => {
    const hit = getLessonTitleOnly(item) === name;
    item.classList.toggle("active", hit);

    if (hit) {
        const parentItems = item.closest(".lesson-items");
        if (parentItems) parentItems.style.display = "block";
    }
    });
}

// 初次載入：localStorage 指定影片 or 預設第一部
waitForPlayerReady(async () => {
    if (videoIdFromStorage) {
    await loadWithResume(videoIdFromStorage);

    if (lessonName && videoTitleEl) {
        videoTitleEl.textContent = lessonName;
    }
    if (lessonName) setActiveByLessonName(lessonName);

    localStorage.removeItem("selectedLesson");
    localStorage.removeItem("selectedVideoId");
    return;
    }

    // 預設第一部
    if (lessonItems.length > 0) {
    const firstItem = lessonItems[0];
    const firstVideoId = extractVideoId(firstItem.getAttribute("data-src"));
    if (firstVideoId) await loadWithResume(firstVideoId);

    if (videoTitleEl) videoTitleEl.textContent = getLessonTitleOnly(firstItem);
    setActiveByElement(firstItem);
    }
});

// 點擊同頁切換影片：
// ① 先存上一部停點到 localStorage
// ② commit 上一部到 Firestore
// ③ 載入新影片並續播（只跳不播）
lessonItems.forEach((item) => {
    item.addEventListener("click", async function (e) {
    e.preventDefault();

    const newVideoId = extractVideoId(this.getAttribute("data-src"));
    if (!newVideoId) return;

    // ① 切換瞬間先抓一次上一部停點到 localStorage
    try {
        const prevVid = player?.getVideoData?.().video_id || currentVideoId || lastStableVideoId;
        if (prevVid && typeof player.getCurrentTime === "function") {
        const prevPos = Math.floor(player.getCurrentTime() || 0);
        if (prevPos > 0) saveResumePositionLocal(prevVid, prevPos);
        }
    } catch {}

    // ② 切換前提交上一部
    await commitCurrentProgress("switch");

    // ③ 載入新影片並續播
    await loadWithResume(newVideoId);

    // ④ UI 標題
    if (videoTitleEl) videoTitleEl.textContent = getLessonTitleOnly(this);
    setActiveByElement(this);
    });
});
});

/* =========================
離開頁面 / 背景：提交一次進度
========================= */
window.addEventListener("pagehide", () => {
stopResumeHeartbeat();
// 不 await，避免卡 UI
commitCurrentProgress("pagehide");
});

let lastPlayedTime = 0;

document.addEventListener("visibilitychange", () => {
if (!player) return;

if (document.visibilityState === "hidden") {
    if (typeof player.getCurrentTime === "function") {
    lastPlayedTime = player.getCurrentTime() || 0;
    }

    // 你要的功能：切背景自動暫停
    if (typeof player.pauseVideo === "function") {
    player.pauseVideo();
    }

    stopResumeHeartbeat();
    commitCurrentProgress("hidden");
} else if (document.visibilityState === "visible") {
    // 回來只跳不播（同 session）
    if (typeof player.seekTo === "function" && lastPlayedTime > 0) {
    player.seekTo(lastPlayedTime, true);
    }
}
});

window.addEventListener("blur", () => {
if (!player) return;
if (typeof player.pauseVideo === "function") player.pauseVideo();
stopResumeHeartbeat();
commitCurrentProgress("blur");
});
