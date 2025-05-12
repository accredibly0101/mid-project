import { auth, db } from './config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

// 登入
document.getElementById("login-btn").addEventListener("click", async () => {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
    
      // ✅ 儲存目前使用者資訊
        localStorage.setItem("user", user.uid);
        window.currentUsername = user.uid;
    
        alert(`登入成功！歡迎 ${user.email}`);
      // 導向主頁（可選）
    window.location.href = "course_index.html";
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

        // 將 info 寫入 users/{uid}/info
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
        info: {
            displayName,
            studentID,
            email
        }
        });

        alert("註冊成功！請重新登入");
    } catch (error) {
        alert("註冊失敗：" + error.message);
    }
});
