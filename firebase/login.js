import { auth, db } from './config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    setPersistence,
    browserSessionPersistence,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

await setPersistence(auth, browserSessionPersistence)

// 登入
document.getElementById("login-btn").addEventListener("click", async () => {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
        // 👉 先設定登入儲存策略：只維持 session
        await setPersistence(auth, browserSessionPersistence);        
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 抓使用者 Firestore 資料
        const userDoc = await getDoc(doc(db, "mid-users", user.uid));
        if (userDoc.exists()) {
            const info = userDoc.data().info || {};
            localStorage.setItem("displayName", info.displayName || "使用者");
            window.displayName = info.displayName || "使用者";
        }

        // 儲存 UID
        localStorage.setItem("user", user.uid);
        window.currentUsername = user.uid;

        alert(`登入成功！歡迎 ${email}`);
        window.location.href = "mid_index.html";
    } catch (error) {
        alert("登入失敗：" + error.message);
    }
});


// 註冊
document.getElementById("register-btn").addEventListener("click", async () => {
const displayName = document.getElementById("displayName").value;
const studentID = document.getElementById("studentID").value;
const email = document.getElementById("register-email").value;
const password = document.getElementById("register-password").value;

try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 建立使用者文件 mid-users/{uid}
    const userRef = doc(db, "mid-users", user.uid);
    await setDoc(userRef, {
    info: {
        displayName,
        studentID,
        email
    },
    status: "active",
    expiresAt: null  // ✅ 空值，之後你再手動補 Timestamp
    });

    alert("註冊成功！請點擊下方重新登入");
    document.getElementById("login-form").style.display = "block";
    document.getElementById("register-form").style.display = "none";
} catch (error) {
    alert("註冊失敗：" + error.message);
}
});

document.getElementById("forgot-password").addEventListener("click", async () => {
    const email = document.getElementById("login-email").value.trim();

    if (!email) {
        alert("請先在 Email 欄位輸入你的信箱，再按「忘記密碼」");
        document.getElementById("login-email").focus();
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        alert("已寄出重設密碼信，請到信箱收信（也記得看垃圾郵件）");
    } catch (error) {
        alert("寄送失敗：" + error.message);
    }
});
