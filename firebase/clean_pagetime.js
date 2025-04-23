import { db } from './config.js';
import {
getDocs,
collection,
doc,
updateDoc,
serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

async function cleanOldPageTimes() {
const usersCol = collection(db, 'users');
const userDocs = await getDocs(usersCol);
const today = new Date().toISOString().split('T')[0];

for (const userDoc of userDocs.docs) {
const data = userDoc.data();
let updated = false;

if (!data.pageTimes) continue;

const newPageTimes = {};

for (const [page, value] of Object.entries(data.pageTimes)) {
    if (typeof value === 'number') {
    // 舊格式是單一數字，轉換為日期物件
    newPageTimes[page] = { [today]: value };
    updated = true;
    } else {
    // 正確格式，保留原狀
    newPageTimes[page] = value;
    }
}

if (updated) {
    const userRef = doc(db, 'users', userDoc.id);
    await updateDoc(userRef, {
    pageTimes: newPageTimes,
    lastUpdate: serverTimestamp()
    });
    console.log(`🔁 已更新：${userDoc.id}`);
}
}

console.log('✅ 所有舊格式已清理完畢');
}

cleanOldPageTimes();
