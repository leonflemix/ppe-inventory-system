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
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBvgtcboYh6obMj4DfB3c-M5OPMpQvYARE",
    authDomain: "ppeinv-62495.firebaseapp.com",
    projectId: "ppeinv-62495",
    storageBucket: "ppeinv-62495.firebasestorage.app",
    messagingSenderId: "88329104396",
    appId: "1:88329104396:web:42e2f2a5df9b06a174d229"
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
    Timestamp
};

