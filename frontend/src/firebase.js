// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getAuth} from 'firebase/auth'
import { Firestore, getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC8K9A0Fo4NIcDLJ8gUT8YFdshSm_z2Xaw",
  authDomain: "ekalavya-53942.firebaseapp.com",
  projectId: "ekalavya-53942",
  storageBucket: "ekalavya-53942.firebasestorage.app",
  messagingSenderId: "298612182036",
  appId: "1:298612182036:web:4bc6b2b587da8405206b01",
  measurementId: "G-TCXKMWS7YB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const db=getFirestore(app);