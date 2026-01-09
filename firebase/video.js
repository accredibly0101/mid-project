import { loadReleaseConfig, isUnitOpen, showLockedMessage, getNowInTaipei } from "./releaseGate.js";
import { videoToUnit } from "./videoMap.js";

import { db, getUsername } from "./config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

/* ---------------------------
工具：取得純標題文字（排除 percent span）
---------------------------- */
function getLessonTitleOnly(el) {
if (!el) return "";
const clone = el.cloneNode(true);
const percent = clone.querySelector(".progress-percent");
if (percent) percent.remove();
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
    window.location.replace("mid_index.html");
    return;
}

const open = isUnitOpen(releaseConfig, unitKey, now);
if (!open) {
    showLockedMessage("此影片尚未開放");

    localStorage.removeItem("currentVideoId");
    localStorage.removeItem("currentVideoTitle");

    window.location.replace("mid_video.html"); // 依你的檔名調整
    return;
}
})();

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
        // 沒有有效續播點就清掉或顯示別的文字（你可改）
        el.textContent = ``;
    }
}



/* ---------------------------
Firestore 參考
---------------------------- */
const username = getUsername();
// 若 username 可能為空，至少不要 throw
const userRef = doc(db, "mid-users", username || "anonymous");

/* =========================
✅ 續播（localStorage 心跳）設定
========================= */
const RESUME_KEY = "resumePositions_v1";
const resumeMemCache = {}; // 記憶體快取：同頁更快

function loadResumeMap() {
try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) || "{}");
} catch {
    return {};
}
}

function saveResumePositionLocal(videoId, seconds) {
if (!videoId || typeof seconds !== "number") return;
// 避免寫入太小或 NaN
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
優先 localStorage，沒有再用 Firestore
---------------------------- */
async function loadWithResume(videoId) {
    let pos = getResumePositionLocal(videoId);
    if (pos < 5) pos = await getResumePositionRemote(videoId);
    if (pos < 5) pos = 0;

    setResumeHint(pos); // ✅ 更新「已跳回...」文字

    // ✅ 用 startSeconds 載入（比 load+seek 更穩）
    player.loadVideoById({ videoId, startSeconds: pos });
}

/* =========================
YouTube Player 設定
========================= */
var tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.getElementsByTagName("script")[0].parentNode.insertBefore(tag, null);

let player;

// 觀看時間統計（用於 duration/percent）
let sessionStartTime = null;

// 當前影片資訊（由 YouTube 播放後取得）
let currentVideoId = "";
let currentVideoTitle = "";
let currentVideoDuration = 0;

// ✅ 心跳定時器
let resumeTimer = null;

// ✅ 記錄「上一個穩定的影片 id」（避免某些狀態抓不到）
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
    // 不要吵使用者
    }
}, 2000);
}

function stopResumeHeartbeat() {
if (resumeTimer) clearInterval(resumeTimer);
resumeTimer = null;
}

/* =========================
✅ 存影片資料到 Firestore（保留你原結構 + 加 lastPosition）
- videos[videoId] = { title, duration, percentWatched, completed, lastPosition, lastWatchedAt }
========================= */
async function saveVideoData({
videoId,
title,
watchTimeSeconds,
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
        duration: 0,
        completed: false,
        percentWatched: 0,
        lastPosition: 0,
    };
    } else {
    // 補標題
    if (!videos[videoId].title || videos[videoId].title === "") {
        videos[videoId].title = title || "未知標題";
    }
    }

    // ✅ 寫入 lastPosition（續播用）
    if (typeof positionSeconds === "number" && positionSeconds >= 0) {
    videos[videoId].lastPosition = positionSeconds;
    videos[videoId].lastWatchedAt = serverTimestamp();

    // 同步 localStorage（讓同頁切換立即生效）
    saveResumePositionLocal(videoId, positionSeconds);
    }

    // ✅ 加總觀看秒數（研究/完成度用）
    const dur = (typeof durationSecondsSnapshot === "number" && durationSecondsSnapshot > 0)
    ? durationSecondsSnapshot
    : 0;

    if (typeof watchTimeSeconds === "number" && watchTimeSeconds > 0) {
    const prev = videos[videoId].duration || 0;
    const newTotal = prev + watchTimeSeconds;

    const capped = (dur > 0) ? Math.min(newTotal, dur) : newTotal;
    videos[videoId].duration = capped;

    if (dur > 0) {
        videos[videoId].percentWatched = Math.round((capped / dur) * 100);

        if ((capped / dur) >= 0.8) {
        videos[videoId].completed = true;
        }
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

    // ✅ 更新 percent UI
    if (typeof window.updateLessonProgressUI === "function") {
    window.updateLessonProgressUI();
    }

    // Debug
    // console.log("✅ saveVideoData", videoId, "watch+", watchTimeSeconds, "pos=", positionSeconds);
} catch (e) {
    console.error("❌ 儲存影片紀錄失敗：", e);
}
}

/* =========================
✅ 核心：提交「目前正在看的影片」進度（不用先暫停）
- 一定要在 loadVideoById 前呼叫（避免 currentTime reset）
========================= */
async function commitCurrentProgress(reason = "manual") {
try {
    if (!player) return;

    const vid = player.getVideoData?.().video_id || currentVideoId || lastStableVideoId;
    if (!vid) return;

    const pos = (typeof player.getCurrentTime === "function")
    ? Math.floor(player.getCurrentTime() || 0)
    : 0;

    // 有些狀態會拿不到 title（保底）
    const title = player.getVideoData?.().title || currentVideoTitle || "";

    // 用 sessionStartTime 算本次新增觀看秒數
    let watchTime = 0;
    if (sessionStartTime) {
    watchTime = Math.floor((Date.now() - sessionStartTime) / 1000);
    }

    // 用「切換前的影片總長」做 cap/percent（切換前抓才準）
    const durSnap = (typeof player.getDuration === "function")
    ? (player.getDuration() || currentVideoDuration || 0)
    : (currentVideoDuration || 0);

    // ✅ 提交
    await saveVideoData({
    videoId: vid,
    title,
    watchTimeSeconds: watchTime,
    positionSeconds: pos,
    durationSecondsSnapshot: durSnap,
    });

    // ✅ 重置本次 session（避免重複加總）
    sessionStartTime = null;

    // console.log(`✅ commit(${reason})`, vid, "watch+", watchTime, "pos=", pos);
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

// PLAYING：開始計時 + 開啟心跳
if (event.data === YT.PlayerState.PLAYING) {
    sessionStartTime = Date.now();

    const vd = player.getVideoData?.() || {};
    currentVideoId = vd.video_id || currentVideoId;
    currentVideoTitle = vd.title || currentVideoTitle;

    if (currentVideoId) lastStableVideoId = currentVideoId;

    currentVideoDuration = (typeof player.getDuration === "function") ? (player.getDuration() || 0) : 0;

    startResumeHeartbeat();
}

// PAUSED / ENDED：停止心跳 + 提交一次（補強）
if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
    stopResumeHeartbeat();
    // 這裡提交當作補強；真正「切換」會在 click 時先提交
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
        videoTitleEl.textContent = lessonName; // localStorage 存的標題不含 %
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

// ✅ 點擊同頁切換影片：
// 1) 先把「上一部」的停點立刻寫入 localStorage（保險）
// 2) commit 進 Firestore（不用先暫停）
// 3) 用 startSeconds 載入新影片（只跳不播）
lessonItems.forEach((item) => {
    item.addEventListener("click", async function (e) {
    e.preventDefault();

    const newVideoId = extractVideoId(this.getAttribute("data-src"));
    if (!newVideoId) return;

    // ① 切換瞬間先抓一次上一部停點到 localStorage（最穩）
    try {
        const prevVid = player?.getVideoData?.().video_id || currentVideoId || lastStableVideoId;
        if (prevVid && typeof player.getCurrentTime === "function") {
        const prevPos = Math.floor(player.getCurrentTime() || 0);
        if (prevPos > 0) saveResumePositionLocal(prevVid, prevPos);
        }
    } catch {}

    // ② 切換前提交上一部進度（不必先按暫停）
    await commitCurrentProgress("switch");

    // ③ 載入新影片並續播（只跳不播）
    await loadWithResume(newVideoId);

    // ④ UI：標題不要吃到 12%
    if (videoTitleEl) videoTitleEl.textContent = getLessonTitleOnly(this);
    setActiveByElement(this);
    });
});
});

/* =========================
離開頁面 / 背景：提交一次進度（避免丟失）
========================= */
window.addEventListener("pagehide", () => {
stopResumeHeartbeat();
// pagehide 不要卡住 UI，不 await
commitCurrentProgress("pagehide");
});

let lastPlayedTime = 0; // 同一次 session 用（不是 Firestore 續播）

document.addEventListener("visibilitychange", () => {
if (!player) return;

if (document.visibilityState === "hidden") {
    // ✅ 先記住目前時間
    if (typeof player.getCurrentTime === "function") {
    lastPlayedTime = player.getCurrentTime() || 0;
    }

    // ✅ 自動暫停（你要的功能）
    if (typeof player.pauseVideo === "function") {
    player.pauseVideo();
    }

    // ✅ 停止心跳 + 提交一次進度（續播與 percent 更新）
    stopResumeHeartbeat();
    commitCurrentProgress("hidden");
} else if (document.visibilityState === "visible") {
    // ✅ 回來只跳不播（同 session）
    if (typeof player.seekTo === "function" && lastPlayedTime > 0) {
    player.seekTo(lastPlayedTime, true);
    // 不呼叫 playVideo(); 只跳不播
    }
}
});

window.addEventListener("blur", () => {
    if (!player) return;
    if (typeof player.pauseVideo === "function") player.pauseVideo();
    stopResumeHeartbeat();
    commitCurrentProgress("blur");
});
