// 連接youtube api並建立播放器
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    
function onYouTubeIframeAPIReady() {
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
        }
        
        // 測試用的簡單處理事件（可暫時加上）
        function onPlayerReady(event) {
        console.log('Player is ready');
        }
        function onPlayerStateChange(event) {
        console.log('Player state changed:', event.data);
        }

document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonName = urlParams.get("lesson");

    const lessonItems = document.querySelectorAll(".lesson-item");
    const videoTitle = document.querySelector(".video-title");

    // 等待 YouTube Player 初始化完畢再繼續操作
    function waitForPlayerReady(callback) {
        if (window.player && typeof player.loadVideoById === "function") {
            callback();
        } else {
            setTimeout(() => waitForPlayerReady(callback), 100);
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

            // 切換影片
            const videoId = extractVideoId(this.getAttribute("data-src"));
            if (videoId && window.player) {
                player.loadVideoById(videoId);
            }
        });
    });

    // 3️⃣ 展開/收合課程單元
    document.querySelectorAll(".lesson-header").forEach(header => {
        header.addEventListener("click", function () {
            let items = this.nextElementSibling;
            items.style.display = items.style.display === "block" ? "none" : "block";
        });
    });
});
