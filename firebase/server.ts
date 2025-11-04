// firebase/server.ts
import { credential } from "firebase-admin";
import { getApps, ServiceAccount } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { Auth, getAuth } from "firebase-admin/auth";

// Fix private key formatting - handle both \n and actual newlines
const formatPrivateKey = (key: string | undefined): string => {
  if (!key) {
    throw new Error("FIREBASE_PRIVATE_KEY is not defined in environment variables");
  }
  
  // Replace literal \n with actual newlines
  let formattedKey = key.replace(/\\n/g, '\n');
  
  // Remove any quotes that might be in the string
  formattedKey = formattedKey.replace(/^["']|["']$/g, '');
  
  return formattedKey;
};

const serviceAccount = {
  "type": "service_account",
  "project_id": "comix-b9180",
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID!.replace(/^["']|["']$/g, ''),
  "private_key": formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL!.replace(/^["']|["']$/g, ''),
  "client_id": process.env.FIREBASE_CLIENT_ID!.replace(/^["']|["']$/g, ''),
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL!.replace(/^["']|["']$/g, ''))}`,
  "universe_domain": "googleapis.com"
};

let firestore: Firestore;
let auth: Auth;

function initializeFirebase() {
  try {
    const currentApps = getApps();
    
    if (currentApps.length === 0) {
      console.log("🔥 Initializing Firebase Admin...");
      
      // Validate private key format
      if (!serviceAccount.private_key.includes('BEGIN PRIVATE KEY')) {
        throw new Error("Invalid private key format - missing BEGIN PRIVATE KEY header");
      }
      
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as ServiceAccount),
      });
      
      firestore = getFirestore(app);
      auth = getAuth(app);
      
      console.log("✅ Firebase Admin initialized successfully");
    } else {
      const app = currentApps[0];
      firestore = getFirestore(app);
      auth = getAuth(app);
      console.log("✅ Using existing Firebase Admin instance");
    }
    
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error);
    console.error("Private key preview:", process.env.FIREBASE_PRIVATE_KEY?.substring(0, 50));
    throw error;
  }
}

initializeFirebase();

export { firestore, auth };