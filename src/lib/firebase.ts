
// src/lib/firebase.ts

// =====================================================================================
// !! CRITICAL CHECK !!
// Ensure all NEXT_PUBLIC_FIREBASE_... environment variables are correctly set in:
// 1. Your local `.env.local` file (in the project root).
// 2. Your hosting provider's (e.g., Vercel, Netlify) environment variable settings
//    for DEPLOYED environments.
//
// Missing or INCORRECT values here are the MOST COMMON cause for "client is offline"
// or "failed to get document" errors from Firebase/Firestore.
// Double-check each value against your Firebase project settings.
// =====================================================================================

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
if (typeof window !== 'undefined') { // Run these checks only on the client-side for NEXT_PUBLIC_ variables
    if (!firebaseConfig.apiKey) {
        console.warn("Firebase Setup Warning: NEXT_PUBLIC_FIREBASE_API_KEY is UNDEFINED. Firebase will likely fail to initialize/connect. Check your environment variables (.env.local or hosting provider settings).");
        configComplete = false;
    }
    if (!firebaseConfig.projectId) {
        console.warn("Firebase Setup Warning: NEXT_PUBLIC_FIREBASE_PROJECT_ID is UNDEFINED. Firebase will likely fail to initialize/connect. Check your environment variables.");
        configComplete = false;
    }
    if (!firebaseConfig.authDomain) {
        console.warn("Firebase Setup Warning: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is UNDEFINED. Firebase will likely fail to initialize/connect. Check your environment variables.");
        configComplete = false;
    }
    // Add checks for other essential variables if needed
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
         console.log("Firebase initialized successfully with Project ID:", firebaseConfig.projectId);
    } catch (e) {
        console.error("Firebase initialization error:", e);
        // @ts-ignore
        db = undefined; // Ensure db is undefined if init fails
    }
  } else {
    console.error("Firebase FATAL Error: Firebase configuration is INCOMPLETE or environment variables are not loaded. App will not be initialized. Please meticulously check your .env.local file (for local development) or your hosting provider's environment variable settings (for deployment) for ALL `NEXT_PUBLIC_FIREBASE_...` values. Refer to Firebase project settings.");
    // @ts-ignore
    app = undefined;
    // @ts-ignore
    db = undefined;
  }
} else {
  app = getApp();
  try {
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase: Error getting Firestore instance from existing app:", e);
    // @ts-ignore
    db = undefined;
  }
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
