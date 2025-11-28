// Filename: firebase.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc, 
    runTransaction, 
    query, 
    where, 
    getDocs, 
    getDoc,
    setDoc,
    Timestamp,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
// IMPORTANT: Replace this with your own Firebase project configuration.
const firebaseConfig = {
  apiKey: "AIzaSyA3eWXqSDHrFnlWi2FWDR4kJGVWTJZxzIc",
  authDomain: "ppe-dm.firebaseapp.com",
  projectId: "ppe-dm",
  storageBucket: "ppe-dm.firebasestorage.app",
  messagingSenderId: "496669059992",
  appId: "1:496669059992:web:8c9615113ba5c3af16d9ed",
  measurementId: "G-1VL4Z706XD"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export the services and functions to be used in other files
export { 
    auth, 
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    runTransaction,
    query,
    where,
    getDocs,
    getDoc,
    setDoc,
    Timestamp,
    serverTimestamp
};

