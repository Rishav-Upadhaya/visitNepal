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

let app: FirebaseApp | undefined = undefined;
let db: Firestore | undefined = undefined;
// let auth: Auth;
// let storage: FirebaseStorage;

// Check if all required Firebase config values are present
let configComplete = true;
const essentialKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'
];

// Only run detailed checks on the client-side or during build where NEXT_PUBLIC_ vars are expected.
// On the server-side for server components, these might not be directly available if not explicitly passed.
if (typeof window !== 'undefined' || process.env.NODE_ENV === 'build') { // Check during build too
  console.log("Firebase Config Values Being Checked:", {
    apiKey: firebaseConfig.apiKey ? 'SET' : '!!! UNDEFINED/MISSING !!!',
    authDomain: firebaseConfig.authDomain ? 'SET' : '!!! UNDEFINED/MISSING !!!',
    projectId: firebaseConfig.projectId ? 'SET' : '!!! UNDEFINED/MISSING !!!',
    storageBucket: firebaseConfig.storageBucket ? 'SET' : '!!! UNDEFINED/MISSING !!!',
    messagingSenderId: firebaseConfig.messagingSenderId ? 'SET' : '!!! UNDEFINED/MISSING !!!',
    appId: firebaseConfig.appId ? 'SET' : '!!! UNDEFINED/MISSING !!!',
  });

  essentialKeys.forEach(key => {
    const envVarName = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    if (!firebaseConfig[key]) {
      console.error(`Firebase FATAL Config Error: Environment variable ${envVarName} is UNDEFINED. Firebase cannot initialize. Please check your .env.local file (for local development) or your hosting provider's environment variable settings (for deployment). Value for ${key} is currently: ${firebaseConfig[key]}`);
      configComplete = false;
    }
  });
}


if (!getApps().length) {
  if (configComplete) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        // auth = getAuth(app);
        // storage = getStorage(app);
         console.log("Firebase initialized successfully. Project ID:", firebaseConfig.projectId);
    } catch (e) {
        console.error("Firebase initialization error during initializeApp():", e);
        app = undefined;
        db = undefined; // Ensure db is undefined if init fails
    }
  } else {
    console.error("Firebase FATAL Error: Firebase configuration is INCOMPLETE (see previous logs for missing variables). Firebase app WILL NOT be initialized. This will lead to 'client is offline' or similar errors. Please meticulously check your environment variable setup.");
    app = undefined;
    db = undefined;
  }
} else {
  app = getApp();
  try {
    db = getFirestore(app);
     console.log("Firebase app already initialized. Using existing app. Project ID:", app.options.projectId);
  } catch (e) {
    console.error("Firebase: Error getting Firestore instance from existing app:", e);
    db = undefined;
  }
}

if (!db && configComplete) {
    console.warn("Firebase Warning: Firestore 'db' instance is still undefined after attempting initialization, even though configuration seemed complete. This might indicate a deeper issue with Firebase SDKs or project setup.");
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

// For Vercel/Netlify/other hosting: Ensure these NEXT_PUBLIC_ variables are set in the project's environment variable settings on the platform.