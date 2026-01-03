window.addEventListener("DOMContentLoaded", () => {
const lumoEl = document.querySelector('.lumo');
const textEl = document.getElementById('lumoText');

const now = new Date();
const taiwanHour = now.toLocaleString('en-US', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    hour12: false
});
const hour = parseInt(taiwanHour);


let lumoData;

// 根據時間分配屬性
if (hour >= 5 && hour <= 10) {
    lumoData = {
    image: 'img/Lumo/mid-Lumo-index/mid-wake.png',
    texts: [
        '番茄鐘技術建議每25分鐘休息5分鐘，提高專注力。',
        '人的意志力在早晨最強，是做困難任務的黃金時段。',
        '早晨陽光有助調節生理時鐘，提升白天的警覺性與專注力。',
        '早餐攝取蛋白質有助提升注意力與記憶力。',
    ]
    };
    
} else if (hour >= 11 && hour <= 15) {
    lumoData = {
    image: 'img/Lumo/mid-Lumo-index/mid-middle.png',
    texts: [
        '大腦在午餐後容易犯睏，可以用站立式學習保持清醒。',
        '喝水有助於提升注意力，別忽略學習中的補水需求。',
        '適當的休息能幫助大腦整合資訊，提升學習效果。',
        '午休20分鐘有助於恢復專注力與提升記憶力。',
    ]
    };
} else if (hour >= 16 && hour <= 20) {
    lumoData = {
    image: 'img/Lumo/mid-Lumo-index/mid-bath.png',
    texts: [
        '傍晚是整理與複習的好時機，有助長期記憶形成。',
        '日落後藍光會影響睡眠品質，晚間學習記得減少螢幕光。',
        '習慣的養成源自於持續的重複與自我激勵。',
        '適度運動能提升大腦功能與學習效率。',
    ]
    };
} else {
    lumoData = {
    image: 'img/Lumo/mid-Lumo-index/mid-night-1.png',
    texts: [
        '睡前閱讀紙本比使用螢幕更容易入睡也不傷眼。',
        '熬夜會影響海馬迴運作，降低記憶力與理解力。',
        '規律的睡眠習慣有助於提升學習效果與專注力。',
        '熬夜學習反而降低效率，適時休息才能事半功倍。',
    ]
    };
}

// 設定圖片
lumoEl.style.backgroundImage = `url('${lumoData.image}')`;
// 動畫字句輪播
let textIndex = 0;
function showText(text) {
    textEl.innerHTML = '';  // 用 innerHTML 才能解析 <br>
    let i = 0;
    const speed = 50;

    function typeChar() {
        // 逐字打出時，不能直接用 text.charAt(i)，要處理 HTML tag
        // 我們這裡直接一字一字打 innerHTML，簡單但夠用
        if (i < text.length) {
        const currentChar = text.slice(0, i + 1);
        textEl.innerHTML = currentChar;
        i++;
        setTimeout(typeChar, speed);
        }
    }

    typeChar();
}


// 第一次顯示
showText(lumoData.texts[textIndex]);

// 10秒換一次
setInterval(() => {
    textIndex = (textIndex + 1) % lumoData.texts.length;
    showText(lumoData.texts[textIndex]);
}, 10000); // 10秒

});
