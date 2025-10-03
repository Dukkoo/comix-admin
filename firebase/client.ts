// firebase/client.ts
import { initializeApp, getApps } from "firebase/app";
import { Auth, getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB2-N766HO8a2ubYBD798YoEjNglSdyNjk",
  authDomain: "comix-b9180.firebaseapp.com",
  projectId: "comix-b9180",
  storageBucket: "comix-b9180.firebasestorage.app",
  messagingSenderId: "1038766459784",
  appId: "1:1038766459784:web:245c15521dea2f200b083d",
  measurementId: "G-E98GPYDCL8"
};

const currentApps = getApps();
let auth: Auth;

if(!currentApps.length){
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    // Changed to browserLocalPersistence for persistent login
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error("Failed to set persistence:", error);
    });
} else {
    const app = currentApps[0];
    auth = getAuth(app);
}

export { auth };