// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// Firebase 設定
const firebaseConfig = {
    apiKey: "AIzaSyB5wXbrxIhSa5qxdlJ2ucVGR6A-fw9CO4A",
    authDomain: "sample-9b529.firebaseapp.com",
    projectId: "sample-9b529",
    storageBucket: "sample-9b529.appspot.com",  
    messagingSenderId: "76145866246",
    appId: "1:76145866246:web:1fbd9037702f16e0837587"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ⬇️ 加一個「取得目前使用者名稱」的函式
// ⬇️ 新增一個正確的「函式」

export { auth, db };

export function getUsername() {
    return window.currentUsername || localStorage.getItem("user") || "anonymous";
}
