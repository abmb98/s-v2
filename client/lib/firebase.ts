import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDDO_7qvJvngCnJDopqfZEqTCsW39YqCFs",
  authDomain: "secteur-e639e.firebaseapp.com",
  projectId: "secteur-e639e",
  storageBucket: "secteur-e639e.firebasestorage.app",
  messagingSenderId: "834372572362",
  appId: "1:834372572362:web:f866cdd9d1519a2ec65033"
};

// Debug: Log Firebase config
console.log('Initializing Firebase with config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  apiKey: firebaseConfig.apiKey.substring(0, 10) + '...'
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Test Firebase connectivity with retry logic
export const testFirebaseConnection = async (retries = 3): Promise<{ success: boolean; error?: string }> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Testing Firebase connection... (attempt ${attempt}/${retries})`);

      // Test Firestore connection using a valid collection name
      const testDoc = doc(db, 'app_config', 'connection_test');

      // Add timeout to the request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });

      const connectionPromise = getDoc(testDoc);
      await Promise.race([connectionPromise, timeoutPromise]);

      console.log('Firebase connection: SUCCESS');
      return { success: true };
    } catch (error: any) {
      console.error(`Firebase connection test failed (attempt ${attempt}):`, error);

      // If this isn't the last attempt, wait before retrying
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      let errorMessage = 'Unknown connection error';

      if (error.message === 'Connection timeout') {
        errorMessage = 'Connection timeout - Firebase service may be slow or unreachable';
      } else if (error.code) {
        switch (error.code) {
          case 'unavailable':
            errorMessage = 'Firebase service is temporarily unavailable';
            break;
          case 'permission-denied':
            errorMessage = 'Firebase permissions issue - this is normal for connection testing';
            // Permission denied is actually OK for connection testing - it means we can reach Firebase
            console.log('Permission denied is normal for connection test - Firebase is reachable');
            return { success: true };
          case 'failed-precondition':
            errorMessage = 'Firebase configuration error';
            break;
          case 'unauthenticated':
            errorMessage = 'Firebase authentication configuration issue';
            break;
          case 'invalid-argument':
            errorMessage = 'Invalid request - check collection/document names';
            break;
          case 'network-request-failed':
            errorMessage = 'Network request failed - check internet connection';
            break;
          default:
            errorMessage = `Firebase error: ${error.code}`;
        }
      } else if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network connectivity issue - check internet connection and firewall settings';
      } else if (error.message?.includes('CORS')) {
        errorMessage = 'CORS policy error - check Firebase domain configuration';
      } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
        errorMessage = 'Network fetch error - possible firewall or connectivity issue';
      }

      return { success: false, error: errorMessage };
    }
  }

  return { success: false, error: 'Connection failed after all retry attempts' };
};

export default app;
