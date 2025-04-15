// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

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

// 導出 `db` 讓其他檔案可以使用
export { db };
