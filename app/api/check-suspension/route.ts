import { NextRequest, NextResponse } from 'next/server';
import { auth, firestore } from '@/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();

    if (!token || !userId) {
      return NextResponse.json(
        { error: 'Token and userId required' },
        { status: 400 }
      );
    }

    // Token verify хий
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // User-ийн бан статус шалгах
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

    // Ban шалгалт
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
        // Ban дууссан - цэвэрлэх
        await userDocRef.update({
          bannedUntil: null,
          banReason: null,
          updatedAt: new Date(),
        });
      }
    }

    return NextResponse.json({
      suspended: false,
    });

  } catch (error: any) {
    console.error('Suspension check error:', error);
    return NextResponse.json(
      { error: 'Check failed' },
      { status: 500 }
    );
  }
}