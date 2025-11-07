import { NextRequest, NextResponse } from 'next/server';
import { auth, firestore } from '@/firebase/server';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
         request.headers.get('cf-connecting-ip') ||
         request.headers.get('x-real-ip') ||
         'unknown';
}

function jsonResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, token, deviceId, deviceName, userId, email, banDays, banReason } = body;

    if (!token) {
      return jsonResponse({ error: 'Token required' }, 400);
    }

    // Token verify
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      return jsonResponse({ error: 'Invalid token' }, 401);
    }

    // === REGISTER DEVICE ===
    if (action === 'register-device') {
      if (!deviceId) {
        return jsonResponse({ error: 'deviceId required' }, 400);
      }

      const userId = decodedToken.uid;
      const clientIP = getClientIP(request);

      try {
        const devicesRef = firestore.collection('users').doc(userId).collection('devices');
        const devicesSnapshot = await devicesRef.get();

        let isNewDevice = true;
        for (const doc of devicesSnapshot.docs) {
          if (doc.data().deviceId === deviceId) {
            isNewDevice = false;
            // Update existing device
            await doc.ref.update({
              lastActive: new Date(),
              lastIP: clientIP,
              loginCount: (doc.data().loginCount || 0) + 1,
            });
            break;
          }
        }

        // Register new device
        if (isNewDevice) {
          await devicesRef.add({
            deviceId,
            deviceName: deviceName || 'Unknown Device',
            createdAt: new Date(),
            lastActive: new Date(),
            lastIP: clientIP,
            loginCount: 1,
          });
        }

        const updatedSnapshot = await devicesRef.get();

        return jsonResponse({
          success: true,
          activeDeviceCount: updatedSnapshot.size,
        });
      } catch (error: any) {
        console.error('Device registration error:', error);
        return jsonResponse({ error: 'Registration failed' }, 500);
      }
    }

    // === GET DEVICES ===
    if (action === 'get-devices') {
      if (!userId) {
        return jsonResponse({ error: 'userId required' }, 400);
      }

      try {
        const devicesRef = firestore
          .collection('users')
          .doc(userId)
          .collection('devices');
        
        const devicesSnapshot = await devicesRef.get();
        const devices = devicesSnapshot.docs.map(doc => ({
          deviceId: doc.id,
          ...doc.data(),
        }));

        return jsonResponse({ devices });
      } catch (error: any) {
        console.error('Get devices error:', error);
        return jsonResponse({ error: 'Failed to get devices' }, 500);
      }
    }

    // === DELETE DEVICE ===
    if (action === 'delete-device') {
      if (!deviceId) {
        return jsonResponse({ error: 'deviceId required' }, 400);
      }

      const userId = decodedToken.uid;

      try {
        const deviceRef = firestore
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId);
        
        await deviceRef.delete();

        return jsonResponse({ success: true });
      } catch (error: any) {
        console.error('Delete device error:', error);
        return jsonResponse({ error: 'Failed to delete device' }, 500);
      }
    }

    // === CLEAR ALL DEVICES ===
    if (action === 'clear-devices') {
      if (!userId) {
        return jsonResponse({ error: 'userId required' }, 400);
      }

      try {
        const devicesRef = firestore
          .collection('users')
          .doc(userId)
          .collection('devices');
        
        const devicesSnapshot = await devicesRef.get();
        const deletePromises = devicesSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);

        return jsonResponse({ success: true });
      } catch (error: any) {
        console.error('Clear devices error:', error);
        return jsonResponse({ error: 'Failed to clear devices' }, 500);
      }
    }

    // === SEARCH USER (ADMIN) ===
    if (action === 'search-user') {
      if (!email) {
        return jsonResponse({ error: 'Email required' }, 400);
      }

      try {
        // Search user by email
        const usersRef = firestore.collection('users');
        const query = usersRef.where('email', '==', email.toLowerCase());
        const snapshot = await query.get();

        if (snapshot.empty) {
          return jsonResponse({ error: 'User not found' }, 404);
        }

        const userDoc = snapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();

        // Get devices
        const devicesRef = firestore.collection('users').doc(userId).collection('devices');
        const devicesSnapshot = await devicesRef.get();
        const devices = devicesSnapshot.docs.map(doc => ({
          deviceId: doc.id,
          ...doc.data(),
        }));

        return jsonResponse({
          user: {
            userId,
            email: userData.email,
            deviceCount: devices.length,
            devices,
            bannedUntil: userData.bannedUntil,
            banReason: userData.banReason,
          },
        });
      } catch (error: any) {
        console.error('Search user error:', error);
        return jsonResponse({ error: 'Search failed' }, 500);
      }
    }

    // === BAN USER (ADMIN) ===
    if (action === 'ban-user') {
      if (!userId || !banDays) {
        return jsonResponse({ error: 'userId and banDays required' }, 400);
      }

      try {
        const userDocRef = firestore.collection('users').doc(userId);
        const banUntilDate = new Date();
        banUntilDate.setDate(banUntilDate.getDate() + banDays);

        await userDocRef.update({
          bannedUntil: banUntilDate.toISOString(),
          banReason: banReason || 'Та системийн нөхцөлийг зөрчилсөн',
          updatedAt: new Date(),
        });

        return jsonResponse({ success: true });
      } catch (error: any) {
        console.error('Ban user error:', error);
        return jsonResponse({ error: 'Ban failed' }, 500);
      }
    }

    return jsonResponse({ error: 'Invalid action' }, 400);

  } catch (error: any) {
    console.error('API error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}