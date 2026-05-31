import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebaseコンソール(https://console.firebase.google.com)から取得した設定に置き換えてください
const firebaseConfig = {
  apiKey: "AIzaSyDFxNrY7Gs8uW_XiCVGpDLz35o3p-yjNAI",
  authDomain: "anime-quiz-6515c.firebaseapp.com",
  databaseURL: "https://anime-quiz-6515c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "anime-quiz-6515c",
  storageBucket: "anime-quiz-6515c.firebasestorage.app",
  messagingSenderId: "853763937783",
  appId: "1:853763937783:web:cf9bb04c8ea261b9fb0af2"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
