// scripts/migrateUsers.ts
// Run this once to add userId to all existing users

// Load environment variables FIRST
import dotenv from 'dotenv';
import path from 'path';

// Try to load .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

try {
  dotenv.config({ path: envLocalPath });
  console.log('✅ Loaded .env.local');
} catch {
  dotenv.config({ path: envPath });
  console.log('✅ Loaded .env');
}

// Now import Firebase (after env vars are loaded)
import { auth, firestore } from "../firebase/server";

async function generateUniqueUserId(): Promise<number> {
  const min = 10000;
  const max = 99999;
  
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const userId = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Check if this userId already exists
    const existingUser = await firestore
      .collection("users")
      .where("userId", "==", userId)
      .limit(1)
      .get();
    
    if (existingUser.empty) {
      return userId;
    }
    
    attempts++;
  }
  
  throw new Error("Could not generate unique userId after max attempts");
}

async function migrateUsers() {
  console.log("🚀 Starting user migration...");
  
  try {
    // Get all users from Firebase Auth
    const authUsers = await auth.listUsers(1000);
    console.log(`📊 Found ${authUsers.users.length} users in Firebase Auth`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const authUser of authUsers.users) {
      try {
        const userRef = firestore.collection("users").doc(authUser.uid);
        const userDoc = await userRef.get();
        
        const updateData: any = {};
        let needsUpdate = false;
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          
          // Add userId if missing
          if (!userData?.userId) {
            const newUserId = await generateUniqueUserId();
            updateData.userId = newUserId;
            needsUpdate = true;
            console.log(`✅ Generated userId ${newUserId} for ${authUser.email}`);
          }
          
          // Add createdAt if missing
          if (!userData?.createdAt) {
            updateData.createdAt = authUser.metadata.creationTime || new Date().toISOString();
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            updateData.updatedAt = new Date().toISOString();
            await userRef.update(updateData);
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          // User document doesn't exist - create it
          const newUserId = await generateUniqueUserId();
          await userRef.set({
            userId: newUserId,
            username: authUser.displayName || authUser.email?.split('@')[0] || 'Unknown',
            email: authUser.email || '',
            xp: 0,
            subscriptionStatus: "not_subscribed",
            createdAt: authUser.metadata.creationTime || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          updatedCount++;
          console.log(`✅ Created document with userId ${newUserId} for ${authUser.email}`);
        }
      } catch (error) {
        console.error(`❌ Error processing user ${authUser.email}:`, error);
        errorCount++;
      }
    }
    
    console.log("\n📊 Migration Summary:");
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log("🎉 Migration completed!");
    
  } catch (error) {
    console.error("💥 Migration failed:", error);
    throw error;
  }
}

// Run migration
migrateUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });