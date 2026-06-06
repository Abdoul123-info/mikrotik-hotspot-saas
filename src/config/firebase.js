import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Remplacez cette configuration par la vôtre depuis la Console Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC77wQh-9C7jNUmKt0-XWyAWtI3xtTigWY",
  authDomain: "hotspot-manager-66d54.firebaseapp.com",
  projectId: "hotspot-manager-66d54",
  storageBucket: "hotspot-manager-66d54.firebasestorage.app",
  messagingSenderId: "560707378011",
  appId: "1:560707378011:web:0646829a33c62077d1187e",
  measurementId: "G-XFMJT5E313"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
