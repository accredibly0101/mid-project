// 課程影片連結、列表按鈕樣式切換的js
document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonName = urlParams.get("lesson");

    const lessonItems = document.querySelectorAll(".lesson-item");
    const videoTitle = document.querySelector(".video-title");
    const player = document.querySelector(".video");

    // 1️⃣ 根據前一頁(課程資訊)的點擊，載入時根據 URL 參數設定 active
    lessonItems.forEach(item => {
        if (lessonName && item.textContent.trim() === lessonName) {
            item.classList.add("active");
            videoTitle.textContent = lessonName;
            player.src = item.getAttribute("data-src");

            // 自動展開所屬的單元
            let parentItems = item.closest(".lesson-items");
            if (parentItems) {
                parentItems.style.display = "block";
            }
        }
    });

    // 2️⃣ 點擊 lesson-item，更新影片 & active 狀態
    lessonItems.forEach(item => {
        item.addEventListener("click", function () {
            // 移除所有 active
            lessonItems.forEach(i => i.classList.remove("active"));

            // 設定當前點擊的 active
            this.classList.add("active");
            videoTitle.textContent = this.textContent.trim();
            player.src = this.getAttribute("data-src");

            // **防止 a 標籤導致頁面重整**
            event.preventDefault();
        });
    });

    // 3️⃣ 點擊 lesson-header 展開 / 收合
    document.querySelectorAll(".lesson-header").forEach(header => {
        header.addEventListener("click", function () {
            let items = this.nextElementSibling;
            items.style.display = items.style.display === "block" ? "none" : "block";
        });
    });
});

