import { loadReleaseConfig, isUnitOpen, showLockedMessage, getNowInTaipei } from "./releaseGate.js";
import { videoToUnit } from "./videoMap.js";

import { db, getUsername } from "./config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

/* =========================
基本工具
========================= */
function extractVideoId(url) {
if (!url) return null;
const match = url.match(/\/embed\/([^\?]+)/);
return match ? match[1] : null;
}

function getLessonTitleOnly(el) {
if (!el) return "";
const clone = el.cloneNode(true);
clone.querySelectorAll(".progress-percent, .circle-progress, .bar-progress, .bar-text").forEach(n => n.remove());
return clone.textContent.trim();
}

function formatTime(seconds) {
seconds = Math.max(0, Math.floor(seconds || 0));
const m = Math.floor((seconds % 3600) / 60);
const s = seconds % 60;
return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* =========================
guardDirectAccess（導回 mid_index / mid_video）
========================= */
(async function guardDirectAccess() {
try {
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
    window.location.replace("mid_video.html");
    return;
    }
} catch (e) {
    console.error("❌ guardDirectAccess 失敗：", e);
}
})();

/* =========================
Firestore（mid-users）
========================= */
const COLLECTION_NAME = "mid-users";
const username = getUsername();
const userRef = doc(db, COLLECTION_NAME, username || "anonymous");

const MAX_ADD_PER_COMMIT = 20;      // 差值法每次最多加幾秒
const COMPLETE_THRESHOLD = 80;      // 完成門檻（%）
const RESUME_KEY = "resumePositions_v1";

/* =========================
Local resume（超簡單）
========================= */
function loadResumeMap() {
try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) || "{}");
} catch {
    return {};
}
}

function saveResumeLocal(videoId, seconds) {
if (!videoId) return;
const pos = Math.max(0, Math.floor(seconds || 0));
const map = loadResumeMap();
map[videoId] = pos;
localStorage.setItem(RESUME_KEY, JSON.stringify(map));
}

function getResumeLocal(videoId) {
const map = loadResumeMap();
const v = map[videoId];
return typeof v === "number" ? v : 0;
}

async function getResumeRemote(videoId) {
try {
    const snap = await getDoc(userRef, { source: "server" });
    if (!snap.exists()) return 0;
    const pos = snap.data()?.videos?.[videoId]?.lastPosition;
    return typeof pos === "number" ? pos : 0;
} catch {
    return 0;
}
}

/* =========================
YouTube iframe API
========================= */
var tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.getElementsByTagName("script")[0].parentNode.insertBefore(tag, null);

let player;
let currentVideoId = "";
let currentVideoTitle = "";
let currentVideoDuration = 0;
let resumeTimer = null;
let remoteTickTimer = null;

function startRemoteTick() {
    stopRemoteTick();
    remoteTickTimer = setInterval(() => {
        // 不 await，避免卡 UI
        commitCurrentProgress("remoteTick");
    }, 10000); // 10 秒一次（你可改 8~15 秒）
}

function stopRemoteTick() {
    if (remoteTickTimer) clearInterval(remoteTickTimer);
    remoteTickTimer = null;
}



/* =========================
UI：續播提示 + 按鈕（關鍵：用頁面手勢觸發 seek）
========================= */
function renderResumeUI(pos) {
    const el = document.getElementById("resume-hint");
    if (!el) return;

    if (!pos || pos < 5) {
        // 不要清空，避免你覺得它消失
        el.innerHTML = `<div style="font-size:14px;color:#666;margin:8px 0;">尚無上次觀看紀錄</div>`;
        return;
    }

    el.innerHTML = `
        <div style="display:flex; gap:10px; align-items:center; font-size:14px; color:#444; margin:8px 0;">
        <span>上次看到 <b>${formatTime(pos)}</b></span>
        <button id="resume-btn" type="button" style="
            font-size:12px; color: white; padding:6px 10px; border-radius:10px; border:1px solid #ddd;
            background:var(--mid-color1); cursor:pointer; font-weight:600;
        ">從這裡繼續 ▶</button>
        </div>
    `;
}


function bindResumeButton(pos) {
const btn = document.getElementById("resume-btn");
if (!btn) return;

btn.onclick = async () => {
    if (!player) return;

    // ✅ 這個 click 是「頁面手勢」，手機上 seek 最穩
    try { player.playVideo?.(); } catch {}

    // 多試幾次直到真的跳到位（手機最常需要）
    const target = Math.floor(pos);
    let tries = 0;

    const trySeek = () => {
    tries++;

    try {
        const dur = player.getDuration?.() || 0;
        if (dur > 0) {
        player.seekTo(target, true);
        const ct = player.getCurrentTime?.() || 0;

        // 如果已經跳到接近 target，就成功
        if (Math.abs(ct - target) <= 2 || tries >= 10) {
            // 成功後把 UI 收掉（避免你說的「閃一下又消失」問題）
            const el = document.getElementById("resume-hint");
            if (el) el.innerHTML = "";
            return;
        }
        }
    } catch {}

    if (tries < 10) setTimeout(trySeek, 250);
    };

    trySeek();
};
}

/* =========================
心跳：播放中每 2 秒存 local 停點
========================= */
function startHeartbeat() {
stopHeartbeat();
resumeTimer = setInterval(() => {
    try {
    if (!player || !currentVideoId) return;
    const pos = Math.floor(player.getCurrentTime?.() || 0);
    if (pos > 0) saveResumeLocal(currentVideoId, pos);
    } catch {}
}, 2000);
}
function stopHeartbeat() {
if (resumeTimer) clearInterval(resumeTimer);
resumeTimer = null;
}

/* =========================
Firestore：差值法 + percent=min(...)
========================= */
async function commitProgress() {
try {
    if (!player) return;
    const vid = player.getVideoData?.().video_id || currentVideoId;
    if (!vid) return;

    const pos = Math.floor(player.getCurrentTime?.() || 0);
    const title = player.getVideoData?.().title || currentVideoTitle || "";
    const durSnap = player.getDuration?.() || currentVideoDuration || 0;

    const docSnap = await getDoc(userRef);
    const data = docSnap.exists() ? docSnap.data() : {};
    const videos = data.videos || {};

    if (!videos[vid]) {
    videos[vid] = {
        title: title || "未知標題",
        duration: 0,            // watchTimeTotal
        percentWatched: 0,
        completed: false,
        lastPosition: 0,
        lastCommitPosition: 0,
    };
    }

    // lastPosition
    videos[vid].lastPosition = pos;
    videos[vid].lastWatchedAt = serverTimestamp();

    // 差值法（只加正向，且每次最多 +20）
    const prevCommit = Math.max(0, Math.floor(videos[vid].lastCommitPosition || 0));
    let delta = Math.max(0, pos - prevCommit);
    if (delta > MAX_ADD_PER_COMMIT) delta = MAX_ADD_PER_COMMIT;

    videos[vid].lastCommitPosition = pos;
    if (delta > 0) videos[vid].duration = (videos[vid].duration || 0) + delta;

    // percent = min(lastPosition/dur, watchTimeTotal/dur)
    const dur = durSnap > 0 ? durSnap : 0;
    if (dur > 0) {
    const r1 = pos / dur;
    const r2 = (videos[vid].duration || 0) / dur;
    const p = Math.round(Math.min(r1, r2) * 100);
    videos[vid].percentWatched = Math.max(videos[vid].percentWatched || 0, Math.max(0, Math.min(100, p)));
    if (videos[vid].percentWatched >= COMPLETE_THRESHOLD) videos[vid].completed = true;
    }

    const nowTW = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).replaceAll("/", "-");

    await setDoc(
    userRef,
    { videos, lastUpdate: serverTimestamp(), lastUpdateDateTW: nowTW },
    { merge: true }
    );

    if (typeof window.updateLessonProgressUI === "function") window.updateLessonProgressUI();
} catch (e) {
    console.error("❌ commitProgress 失敗：", e);
}
}

/* =========================
YouTube ready
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
    onReady: () => console.log("✅ YouTube Player Ready"),
    onStateChange: onPlayerStateChange,
    },
});
};

function onPlayerStateChange(event) {
    if (!player) return;

    if (event.data === YT.PlayerState.PLAYING) {
        const vd = player.getVideoData?.() || {};
        currentVideoId = vd.video_id || currentVideoId;
        currentVideoTitle = vd.title || currentVideoTitle;
        currentVideoDuration = player.getDuration?.() || currentVideoDuration || 0;

        startHeartbeat();
        startRemoteTick(); 
    }

    if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        stopHeartbeat();
        stopRemoteTick();
        commitProgress(event.data === YT.PlayerState.PAUSED ? "pause" : "ended");
    }
}

/* =========================
載入 / 切換（最簡單：只 cue + 顯示續播按鈕）
========================= */
document.addEventListener("DOMContentLoaded", async () => {

if (typeof window.updateLessonProgressUI === "function") window.updateLessonProgressUI();

const lessonItems = document.querySelectorAll(".lesson-item");
const videoTitleEl = document.querySelector(".video-title");

function waitForPlayerReady(cb) {
    if (player && typeof player.cueVideoById === "function") cb();
    else setTimeout(() => waitForPlayerReady(cb), 100);
}

async function cueAndShowResume(videoId, titleText = "") {
    if (!player || !videoId) return;

    // 只 cue（不自動播）
    player.cueVideoById(videoId);

    // 標題
    if (videoTitleEl && titleText) videoTitleEl.textContent = titleText;

    // 先用 local 顯示（快）
    let pos = getResumeLocal(videoId);

    // local 沒有再問 remote（慢但準）
    if (pos < 5) pos = await getResumeRemote(videoId);
    if (pos < 5) pos = 0;

    renderResumeUI(pos);
    bindResumeButton(pos);
}

waitForPlayerReady(async () => {
    // 1) 如果從資訊頁帶了 selectedVideoId
    const lessonName = localStorage.getItem("selectedLesson");
    const videoIdFromStorage = localStorage.getItem("selectedVideoId");

    if (videoIdFromStorage) {
    await cueAndShowResume(videoIdFromStorage, lessonName || "");
    localStorage.removeItem("selectedLesson");
    localStorage.removeItem("selectedVideoId");
    return;
    }

    // 2) 預設第一部
    if (lessonItems.length > 0) {
    const first = lessonItems[0];
    const firstId = extractVideoId(first.getAttribute("data-src"));
    await cueAndShowResume(firstId, getLessonTitleOnly(first));
    }
});

// 清單切換（不 await commit，避免卡；切換後顯示續播按鈕）
lessonItems.forEach((item) => {
    item.addEventListener("click", async (e) => {
    e.preventDefault();

    // 先把上一部提交（背景）
    commitProgress();

    const newId = extractVideoId(item.getAttribute("data-src"));
    await cueAndShowResume(newId, getLessonTitleOnly(item));
    });
});
});

/* =========================
離開頁面 / 背景：提交一次
========================= */
window.addEventListener("pagehide", () => {
    stopHeartbeat();
    stopRemoteTick();
    commitProgress();
});

document.addEventListener("visibilitychange", () => {
if (document.visibilityState === "hidden") {
    stopHeartbeat();
    stopRemoteTick();
    commitProgress();
    
}
});
