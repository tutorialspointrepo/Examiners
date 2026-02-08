// firebase_config.ts
// Firebase Web App Configuration for EXAMINERS React Application

export const firebaseConfig = {
  apiKey: "AIzaSyAgBlBnFUJsu_GlPK4xbJ1lDtCv8lvm1-U",
  authDomain: "examiners-app.firebaseapp.com",
  projectId: "examiners-app",
  storageBucket: "examiners-app.firebasestorage.app",
  messagingSenderId: "29717522325",
  appId: "1:29717522325:web:7a6adb30c0ec393ceb789c",
  measurementId: "G-1JCGG111NC"
};

// Database selection based on environment
// npm run dev  → uses 'examiners-dev' database
// npm run build → uses '(default)' production database
// TODO: Re-enable dev database once separate Firebase dev project is created
// export const firestoreDbName: string | undefined =
//   import.meta.env.VITE_ENV === 'production' ? undefined : 'examiners-dev';
export const firestoreDbName: string | undefined = undefined;

// Log which database is active (helpful during development)
console.log(`🔥 Firestore database: ${firestoreDbName || '(default) PRODUCTION'}`);

export default firebaseConfig;

/**
 * Firebase Configuration for EXAMINERS
 * 
 * This configuration is safe to use in client-side code.
 * Security is managed through Firestore Security Rules.
 * 
 * Project: examiners-app
 * 
 * Database strategy:
 * - Development (npm run dev): uses 'examiners-dev' named database
 * - Production (npm run build): uses '(default)' database
 * 
 * Controlled by VITE_ENV in:
 * - .env.development → VITE_ENV=development
 * - .env.production  → VITE_ENV=production
 * 
 * Services enabled:
 * - Authentication (Email/Password) — shared across both
 * - Firestore Database — separate dev/prod
 * - Storage — shared across both
 * - Analytics (optional)
 */