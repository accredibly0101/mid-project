import { db, getUsername } from './config.js';
import { doc, updateDoc, setDoc, increment } from
"https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

/**
 * @param {Object} options
 * @param {string} [options.collection="mid-users"] Firestore collection name
 * @param {string} [options.pageName] Page name override (default: filename without .html)
 * @param {number} [options.flushEverySeconds=5] Interval seconds for tick+flush
 * @param {number} [options.maxTickSeconds=30] Cap seconds added per tick (anti-explosion)
 * @param {number} [options.maxPendingFlushSeconds=300] Cap seconds written per flush (prevents huge single write)
 * @param {boolean} [options.debug=false] Console logs
 */
export function createPageTimeTracker(options = {}) {
const {
    collection = "mid-users",
    pageName: pageNameFromOptions,
    flushEverySeconds = 5,

    // 防爆：每次 tick 最多補多少秒（避免長時間掛起後一次爆量）
    // 影片頁你可以設 15s~30s；越小越安全，但寫入次數不變（仍每 5 秒 flush）
    maxTickSeconds = 30,

    // 防爆：一次 flush 最多寫入多少秒，避免 pending 很大時單次寫太多
    // (例如網路斷了 10 分鐘，恢復後 pending=600；我們分批慢慢寫)
    maxPendingFlushSeconds = 300,

    debug = false,
} = options;

const username = getUsername();
const pageName =
    pageNameFromOptions ??
    window.location.pathname.split("/").pop().replace(".html", "");

const userDocRef = doc(db, collection, username);

// --- State ---
let visibleStartMs = null;     // 前景起點
let pendingSeconds = 0;        // 累積待寫入秒數
let flushTimer = null;
let isFlushing = false;

// --- Helpers ---
function getTaiwanDateKey(date = new Date()) {
    // yyyy-mm-dd (Asia/Taipei)
    const parts = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    }).formatToParts(date);

    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
}

function clampInt(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

// ✅ 前景期間每次 interval：把「從 visibleStart 到現在」的秒數加到 pending
function tickAccumulate() {
    if (!visibleStartMs) return;

    const now = Date.now();
    const elapsed = Math.floor((now - visibleStartMs) / 1000);

    if (elapsed <= 0) return;

    // 防爆：單次 tick 最多補 maxTickSeconds 秒
    const safe = clampInt(elapsed, 0, maxTickSeconds);
    if (safe <= 0) return;

    pendingSeconds += safe;
    // 把起點往後推 safe 秒，避免重複計算
    visibleStartMs += safe * 1000;

    if (debug) {
    console.log(`⏱️ tick +${safe}s (elapsed=${elapsed}s) pending=${pendingSeconds}s`);
    }
}

// ✅ 把 pending 寫入 Firestore（分批寫，避免一次寫太大）
async function flushPending() {
    if (isFlushing) return;
    if (pendingSeconds <= 0) return;

    isFlushing = true;

    // 分批上限
    const toWrite = Math.min(pendingSeconds, maxPendingFlushSeconds);
    pendingSeconds -= toWrite;

    const dateKey = getTaiwanDateKey(new Date());
    const fieldPath = `pageLogs.${pageName}.${dateKey}`;

    try {
    await updateDoc(userDocRef, {
        [fieldPath]: increment(toWrite)
    });
    if (debug) console.log(`✅ flush +${toWrite}s → ${pageName}｜${dateKey}`);
    } catch (e) {
    if (e?.code === "not-found") {
        // 文件不存在就建立（merge 確保不覆蓋其他欄位）
        try {
        await setDoc(
            userDocRef,
            { pageLogs: { [pageName]: { [dateKey]: toWrite } } },
            { merge: true }
        );
        if (debug) console.log(`📦 create doc +${toWrite}s → ${pageName}｜${dateKey}`);
        } catch (e2) {
        // 建立也失敗：把秒數加回 pending
        pendingSeconds += toWrite;
        console.error("❌ setDoc 失敗，秒數已暫存待下次重試", e2);
        }
    } else {
        // 其他錯誤：把秒數加回 pending
        pendingSeconds += toWrite;
        console.error("❌ updateDoc 失敗，秒數已暫存待下次重試", e);
    }
    } finally {
    isFlushing = false;
    }
}

function startFlushTimer() {
    stopFlushTimer();
    flushTimer = setInterval(() => {
    // 每次心跳：先累積，再寫入
    tickAccumulate();
    flushPending();
    }, flushEverySeconds * 1000);
}

function stopFlushTimer() {
    if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
    }
}

// --- Foreground lifecycle ---
function startForeground() {
    if (visibleStartMs) return;
    visibleStartMs = Date.now();
    startFlushTimer();
    if (debug) console.log("前景計時開始");
}

// 失焦/離開：先把尾巴補上，再 flush 一次（降低漏記）
function endForegroundAndFlushNow() {
    if (!visibleStartMs) {
    // 仍然嘗試 flush（可能 pending 有殘留）
    flushPending();
    stopFlushTimer();
    return;
    }

    // 把最後這段時間補進 pending（同樣用防爆上限）
    tickAccumulate();

    // 清掉前景狀態
    visibleStartMs = null;

    // 立刻 flush 一次
    flushPending();
    stopFlushTimer();

    if (debug) console.log("前景計時結束");
}

// --- Events ---
function onVisibilityChange() {
    if (document.visibilityState === "visible") {
    startForeground();
    } else {
    endForegroundAndFlushNow();
    }
}

function onPageHide() {
    endForegroundAndFlushNow();
}

// --- Public API ---
function start() {
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    if (document.visibilityState === "visible") {
    startForeground();
    }
}

function stop() {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    endForegroundAndFlushNow();
}

return {
    start,
    stop,
    flushPending, // 需要手動強制 flush 時可用
};
}
