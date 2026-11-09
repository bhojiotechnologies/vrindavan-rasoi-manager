import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDtC29ifF3zcKaUgCPt6Yjq1seAYgUNZa8",
  authDomain: "vrindavan-rasoi.firebaseapp.com",
  projectId: "vrindavan-rasoi",
  storageBucket: "vrindavan-rasoi.firebasestorage.app",
  messagingSenderId: "357755106181",
  appId: "1:357755106181:web:8bbda33018da78406d0aec",
  measurementId: "G-CPJ04Z02CY"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
