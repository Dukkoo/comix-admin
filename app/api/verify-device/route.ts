import { NextRequest, NextResponse } from 'next/server';
import { auth, firestore } from '@/firebase/server';

// Device ID генерейшн (client-д ажилладаг)
export function generateDeviceId() {
  const stored = localStorage.getItem('device_id');
  if (stored) return stored;
  
  const deviceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('device_id', deviceId);
  return deviceId;
}

// IP хаяг авах
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
         request.headers.get('cf-connecting-ip') ||
         request.headers.get('x-real-ip') ||
         'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const { token, deviceId, deviceName } = await request.json();

    if (!token || !deviceId) {
      return NextResponse.json(
        { error: 'Token and deviceId required' },
        { status: 400 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const clientIP = getClientIP(request);

    // User document авах
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

    // === BAN ШАЛГАЛТ ===
    if (userData?.bannedUntil) {
      const banEndDate = new Date(userData.bannedUntil);
      const now = new Date();

      if (now < banEndDate) {
        return NextResponse.json(
          {
            banned: true,
            bannedUntil: userData.bannedUntil,
            reason: userData.banReason || '3 аас дээш төхөөрөмжөөс нэвтрэх оролдлого',
            violationCount: userData.violationCount || 0,
          },
          { status: 403 }
        );
      } else {
        // Бан дууссан - цэвэрлэх
        await userDocRef.update({
          bannedUntil: null,
          banReason: null,
          updatedAt: new Date(),
        });
      }
    }

    // === ТӨХӨӨРӨМЖИЙН ХЯЗГААРЛАЛТ ===
    const devicesRef = firestore.collection('users').doc(userId).collection('devices');
    const devicesSnapshot = await devicesRef.get();
    const activeDevices = devicesSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data && data.isActive;
    });

    // Энэ device-г бүртгэлтэй эсэх шалгах
    let isNewDevice = true;
    for (const doc of activeDevices) {
      if (doc.data().deviceId === deviceId) {
        isNewDevice = false;
        // Device-ийн хэлэбэрийг шинэчлэх
        await doc.ref.update({
          lastLogin: new Date(),
          lastIP: clientIP,
          loginCount: (doc.data().loginCount || 0) + 1,
        });
        break;
      }
    }

    // Шинэ device бол
    if (isNewDevice) {
      // 3-аас дээш device байгаа эсэх шалгах
      if (activeDevices.length >= 3) {
        // BAN хийх
        const banUntilDate = new Date();
        banUntilDate.setDate(banUntilDate.getDate() + 7); // 7 хоног

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

      // Шинэ device-г бүртгэх
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
      { error: 'Verification failed', details: error.message },
      { status: 500 }
    );
  }
}