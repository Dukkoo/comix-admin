import { NextRequest, NextResponse } from 'next/server';
import { auth, firestore } from '@/firebase/server';

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
         request.headers.get('cf-connecting-ip') ||
         request.headers.get('x-real-ip') ||
         'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, token, deviceId, deviceName, userId } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400 }
      );
    }

    // Token verify
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // === VERIFY DEVICE ===
    if (action === 'verify-device') {
      if (!deviceId) {
        return NextResponse.json(
          { error: 'deviceId required' },
          { status: 400 }
        );
      }

      const userId = decodedToken.uid;
      const clientIP = getClientIP(request);

      try {
        const userDocRef = firestore.collection('users').doc(userId);
        let userDoc;
        try {
          userDoc = await userDocRef.get();
        } catch (error) {
          console.error('Firestore error:', error);
          return NextResponse.json(
            { error: 'Database error' },
            { status: 500 }
          );
        }

        if (!userDoc || !userDoc.exists) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data() || {};

        // Ban шалгалт
        if (userData?.bannedUntil) {
          const banEndDate = new Date(userData.bannedUntil);
          const now = new Date();

          if (now < banEndDate) {
            return NextResponse.json(
              {
                banned: true,
                bannedUntil: userData.bannedUntil,
                reason: userData?.banReason || '3 аас дээш төхөөрөмжөөс нэвтрэх оролдлого',
                violationCount: userData?.violationCount || 0,
              },
              { status: 403 }
            );
          } else {
            // Ban дууссан - цэвэрлэх
            await userDocRef.update({
              bannedUntil: null,
              banReason: null,
              updatedAt: new Date(),
            });
          }
        }

        // Device count шалгалт
        const devicesRef = firestore.collection('users').doc(userId).collection('devices');
        const devicesSnapshot = await devicesRef.get();
        const activeDevices = devicesSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data && data.isActive;
        });

        let isNewDevice = true;
        for (const doc of activeDevices) {
          if (doc.data().deviceId === deviceId) {
            isNewDevice = false;
            await doc.ref.update({
              lastLogin: new Date(),
              lastIP: clientIP,
              loginCount: (doc.data().loginCount || 0) + 1,
            });
            break;
          }
        }

        // Шинэ device - 3-аас дээш check
        if (isNewDevice) {
          if (activeDevices.length >= 3) {
            const banUntilDate = new Date();
            banUntilDate.setDate(banUntilDate.getDate() + 7);

            await userDocRef.update({
              bannedUntil: banUntilDate.toISOString(),
              banReason: '3 аас дээш төхөөрөмжөөс нэвтрэх оролдлого',
              violationCount: (userData.violationCount || 0) + 1,
              updatedAt: new Date(),
              lastViolationDate: new Date(),
            });

            return NextResponse.json(
              {
                banned: true,
                bannedUntil: banUntilDate.toISOString(),
                reason: '3 аас дээш төхөөрөмжөөс нэвтрэх оролдлого',
                violationCount: (userData.violationCount || 0) + 1,
              },
              { status: 403 }
            );
          }

          // Шинэ device бүртгэх
          await devicesRef.add({
            deviceId,
            deviceName: deviceName || 'Unknown Device',
            firstLogin: new Date(),
            lastLogin: new Date(),
            lastIP: clientIP,
            loginCount: 1,
            isActive: true,
          });
        }

        return NextResponse.json({
          success: true,
          banned: false,
          activeDeviceCount: activeDevices.length + (isNewDevice ? 1 : 0),
          maxDevices: 3,
          isNewDevice,
        });
      } catch (error: any) {
        console.error('Device verification error:', error);
        return NextResponse.json(
          { error: 'Verification failed' },
          { status: 500 }
        );
      }
    }

    // === CHECK SUSPENSION ===
    if (action === 'check-suspension') {
      if (!userId) {
        return NextResponse.json(
          { error: 'userId required' },
          { status: 400 }
        );
      }

      try {
        const userDocRef = firestore.collection('users').doc(userId);
        let userDoc;
        try {
          userDoc = await userDocRef.get();
        } catch (error) {
          console.error('Firestore error:', error);
          return NextResponse.json(
            { error: 'Database error' },
            { status: 500 }
          );
        }

        if (!userDoc || !userDoc.exists) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data() || {};
        const bannedUntil = userData?.bannedUntil;

        if (bannedUntil) {
          const banEndDate = new Date(bannedUntil);
          const now = new Date();

          if (now < banEndDate) {
            return NextResponse.json({
              suspended: true,
              bannedUntil,
              reason: userData?.banReason || '3 аас дээш төхөөрөмжөөс нэвтрэх оролдлого',
              violationCount: userData?.violationCount || 0,
            });
          } else {
            await userDocRef.update({
              bannedUntil: null,
              banReason: null,
              updatedAt: new Date(),
            });
          }
        }

        return NextResponse.json({ suspended: false });
      } catch (error: any) {
        console.error('Suspension check error:', error);
        return NextResponse.json(
          { error: 'Check failed' },
          { status: 500 }
        );
      }
    }

    // === GET DEVICES ===
    if (action === 'get-devices') {
      if (!userId) {
        return NextResponse.json(
          { error: 'userId required' },
          { status: 400 }
        );
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

        return NextResponse.json({ devices });
      } catch (error: any) {
        console.error('Get devices error:', error);
        return NextResponse.json(
          { error: 'Failed to get devices' },
          { status: 500 }
        );
      }
    }

    // === DELETE DEVICE ===
    if (action === 'delete-device') {
      if (!deviceId) {
        return NextResponse.json(
          { error: 'deviceId required' },
          { status: 400 }
        );
      }

      const userId = decodedToken.uid;

      try {
        const deviceRef = firestore
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId);
        
        await deviceRef.delete();

        return NextResponse.json({ success: true });
      } catch (error: any) {
        console.error('Delete device error:', error);
        return NextResponse.json(
          { error: 'Failed to delete device' },
          { status: 500 }
        );
      }
    }

    // === CLEAR ALL DEVICES ===
    if (action === 'clear-devices') {
      if (!userId) {
        return NextResponse.json(
          { error: 'userId required' },
          { status: 400 }
        );
      }

      try {
        const devicesRef = firestore
          .collection('users')
          .doc(userId)
          .collection('devices');
        
        const devicesSnapshot = await devicesRef.get();
        const deletePromises = devicesSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);

        return NextResponse.json({ success: true });
      } catch (error: any) {
        console.error('Clear devices error:', error);
        return NextResponse.json(
          { error: 'Failed to clear devices' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}