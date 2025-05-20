
// src/lib/firebase.ts
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
// import { getAuth, type Auth } from "firebase/auth";
// import { getStorage, type FirebaseStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// Check if all required Firebase config values are present
let configComplete = true;
if (typeof window !== 'undefined') { // Run these checks only on the client-side
    if (!firebaseConfig.apiKey) {
        console.warn("Firebase Warning: NEXT_PUBLIC_FIREBASE_API_KEY is not defined. Firebase might not initialize correctly.");
        configComplete = false;
    }
    if (!firebaseConfig.projectId) {
        console.warn("Firebase Warning: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not defined. Firebase might not initialize correctly.");
        configComplete = false;
    }
    if (!firebaseConfig.authDomain) {
        console.warn("Firebase Warning: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is not defined. Firebase might not initialize correctly.");
        configComplete = false;
    }
}


// Initialize Firebase
let app: FirebaseApp;
let db: Firestore;
// let auth: Auth;
// let storage: FirebaseStorage;

if (!getApps().length) {
  if (configComplete || process.env.NODE_ENV === 'test') { // Allow initialization if config is complete or in test environment
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        // auth = getAuth(app);
        // storage = getStorage(app);
         console.log("Firebase initialized successfully.");
    } catch (e) {
        console.error("Firebase initialization error:", e);
        // @ts-ignore
        db = undefined; // Ensure db is undefined if init fails
    }
  } else {
    console.error("Firebase Error: Firebase configuration is incomplete. App will not be initialized. Please check your .env.local file or deployment environment variables for NEXT_PUBLIC_FIREBASE_... settings.");
    // @ts-ignore
    app = undefined;
    // @ts-ignore
    db = undefined;
  }
} else {
  app = getApp();
  db = getFirestore(app);
}


export { app, db /*, auth, storage */ };

// Remember to create a .env.local file in your project root and add your Firebase config values:
// NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
// NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
// NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
// NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id (optional)
