
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

let configComplete = true;
const essentialKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'
];

console.log("--- Firebase Configuration Check (src/lib/firebase.ts) ---");
essentialKeys.forEach(key => {
  const envVarName = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
  if (!firebaseConfig[key]) {
    console.error(`🔴 CRITICAL FIREBASE CONFIG ERROR: Environment variable ${envVarName} is UNDEFINED or empty.`);
    console.error(`   Value for ${key}: '${firebaseConfig[key]}'`);
    console.error(`   Firebase cannot initialize properly without this. Check .env.local (for local dev) or hosting provider environment variables (for deployment).`);
    configComplete = false;
  } else {
    // console.log(`🟢 Firebase Config: ${envVarName} is SET.`); // Optionally log if set
  }
});

if (!configComplete) {
  console.error("🔴 CRITICAL FIREBASE CONFIG ERROR: One or more essential Firebase environment variables are missing. Firebase app WILL NOT be initialized correctly. This will likely lead to 'client is offline' or similar errors.");
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
    // This block is now covered by the initial `configComplete` check and log.
    // If not configComplete, db will remain undefined.
    console.warn("Firebase: Initialization skipped due to incomplete configuration.");
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

if (!db && configComplete) { // Log this only if config seemed complete but db is still not set
    console.warn("Firebase Warning: Firestore 'db' instance is still undefined after attempting initialization, even though configuration seemed complete. This might indicate a deeper issue with Firebase SDKs or project setup beyond missing env vars.");
} else if (!db && !configComplete) {
    console.error("Firebase Error: Firestore 'db' instance is undefined because the Firebase configuration was incomplete.");
}


export { app, db /*, auth, storage */ };

// REMINDER:
// Create a .env.local file in your project root and add your Firebase config values:
// NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
// NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
// NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
// NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id (optional)

// For Vercel/Netlify/other hosting: Ensure these NEXT_PUBLIC_ variables are set in the project's environment variable settings on the platform.
// Values must be EXACTLY as provided by your Firebase project settings.
