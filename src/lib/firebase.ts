
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
const essentialKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'
];

if (typeof window !== 'undefined') { // Run these checks only on the client-side for NEXT_PUBLIC_ variables
  console.log("Firebase Config Loaded by Client:", {
    apiKey: firebaseConfig.apiKey ? 'SET' : 'UNDEFINED',
    authDomain: firebaseConfig.authDomain ? 'SET' : 'UNDEFINED',
    projectId: firebaseConfig.projectId ? 'SET' : 'UNDEFINED',
    storageBucket: firebaseConfig.storageBucket ? 'SET' : 'UNDEFINED',
    messagingSenderId: firebaseConfig.messagingSenderId ? 'SET' : 'UNDEFINED',
    appId: firebaseConfig.appId ? 'SET' : 'UNDEFINED',
  });

  essentialKeys.forEach(key => {
    if (!firebaseConfig[key]) {
      console.warn(`Firebase Setup Warning: NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()} is UNDEFINED. Firebase may fail to initialize/connect. Check your environment variables (.env.local or hosting provider settings).`);
      configComplete = false;
    }
  });
}


// Initialize Firebase
let app: FirebaseApp | undefined = undefined;
let db: Firestore | undefined = undefined;
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
        app = undefined;
        db = undefined; // Ensure db is undefined if init fails
    }
  } else {
    console.error("Firebase FATAL Error: Firebase configuration is INCOMPLETE or environment variables are not loaded. Firebase app will not be initialized. Please meticulously check your .env.local file (for local development) or your hosting provider's environment variable settings (for deployment) for ALL `NEXT_PUBLIC_FIREBASE_...` values. Refer to your Firebase project settings in the Firebase Console.");
    app = undefined;
    db = undefined;
  }
} else {
  app = getApp();
  try {
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase: Error getting Firestore instance from existing app:", e);
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

