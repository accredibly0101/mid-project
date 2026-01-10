window.addEventListener("DOMContentLoaded", () => {
    const lumoEl = document.querySelector(".video-lumo");
    if (!lumoEl) return;

    // ✅ 只需要圖片清單
    const lumoImages = [
        "./img/Lumo/mid-Lumo-video/lean1.webp",
        "./img/Lumo/mid-Lumo-video/lean2.webp",
        "./img/Lumo/mid-Lumo-video/lean3.webp",
        "./img/Lumo/mid-Lumo-video/sit1.webp",
        "./img/Lumo/mid-Lumo-video/sit2.webp",
        "./img/Lumo/mid-Lumo-video/sit3.webp"
    ];

    let currentIndex = -1;

    function switchLumoImage() {
        let nextIndex;
        do {
        nextIndex = Math.floor(Math.random() * lumoImages.length);
        } while (nextIndex === currentIndex); // ✅ 避免連續同一張

        currentIndex = nextIndex;
        lumoEl.style.backgroundImage = `url('${lumoImages[currentIndex]}')`;
    }

    // 初次顯示
    switchLumoImage();

    // 每 20 秒切一次
    setInterval(switchLumoImage, 20000);
});
