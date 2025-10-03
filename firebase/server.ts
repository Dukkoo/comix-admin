import { credential } from "firebase-admin";
import { getApps, ServiceAccount } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { Auth, getAuth } from "firebase-admin/auth";

const serviceAccount = {
    "type": "service_account",
    "project_id": "comix-b9180",
    "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID!,
    "private_key": (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    "client_email": process.env.FIREBASE_CLIENT_EMAIL!,
    "client_id": process.env.FIREBASE_CLIENT_ID!,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL!)}`,
    "universe_domain": "googleapis.com"
};

let firestore: Firestore;
let auth: Auth;

function initializeFirebase() {
    try {
        const currentApps = getApps();
        
        if (currentApps.length === 0) {
            const app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount as ServiceAccount),
            });
            
            firestore = getFirestore(app);
            auth = getAuth(app);
        } else {
            const app = currentApps[0];
            firestore = getFirestore(app);
            auth = getAuth(app);
        }
        
    } catch (error) {
        console.error("❌ Firebase initialization failed:", error);
        throw error;
    }
}

initializeFirebase();

export { firestore, auth };