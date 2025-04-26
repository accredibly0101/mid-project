// 切換帳號

(function () {
    // 檢查是否在本地開發模式（例如 localhost）
    const isDevMode = location.hostname === "localhost" || location.hostname === "127.0.0.1";

    if (!isDevMode) {
    console.warn("⚠️ Devtools.js 僅在開發環境生效");
    return;
    }

    // 讀取當前 URL 的 user 參數，優先用網址，沒有就從 localStorage 撈
    let urlParams = new URLSearchParams(window.location.search);
    let username = urlParams.get('user') || localStorage.getItem('user') || 'anonymous';

    // 更新 localStorage，確保跳頁後能記住
    localStorage.setItem('user', username);

    // 讓全站都能拿到 username
    window.currentUsername = username;

    // 如果網址沒帶 user，就自動加上去
    if (!urlParams.get('user')) {
    const currentPage = window.location.pathname.split('/').pop();
    window.location.href = `${currentPage}?user=${username}`;
    return; // 避免重複執行下面
    }

    // === 生成帳號切換小工具 ===
    const devtoolWrapper = document.createElement('div');
    devtoolWrapper.style.position = 'fixed';
    devtoolWrapper.style.top = '10px';
    devtoolWrapper.style.left = '10px';
    devtoolWrapper.style.zIndex = '9999';
    devtoolWrapper.style.background = 'rgba(0,0,0,0.7)';
    devtoolWrapper.style.color = '#fff';
    devtoolWrapper.style.padding = '6px 10px';
    devtoolWrapper.style.borderRadius = '6px';
    devtoolWrapper.style.fontSize = '14px';

    devtoolWrapper.innerHTML = `
    👤 <select id="userSelect" style="margin-left:5px;">
        <option value="anonymous">anonymous</option>
        <option value="user1">user1</option>
        <option value="user2">user2</option>
        <option value="user3">user3</option>
    </select>
    `;

    document.body.appendChild(devtoolWrapper);

    // 預設選中當前帳號
    const userSelect = document.getElementById('userSelect');
    userSelect.value = username;

    // 切換帳號時
    userSelect.addEventListener('change', (e) => {
    const selectedUser = e.target.value;
    localStorage.setItem('user', selectedUser);
    const currentPage = window.location.pathname.split('/').pop();
    window.location.href = `${currentPage}?user=${selectedUser}`;
    });

    // 自動幫所有 <a> 標籤加上 user
    document.querySelectorAll('a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.endsWith('.html')) {
        const url = new URL(href, window.location.origin);
        url.searchParams.set('user', username);
        link.setAttribute('href', url.pathname + url.search);
    }
    });

    console.log(`🛠️ Devtools.js 已啟動，當前使用者：${username}`);
})();
