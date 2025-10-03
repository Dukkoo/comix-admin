// app/api/auth/token/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    
    // ADD THIS DEBUG LINE HERE:
    console.log('All cookies:', cookieHeader);
    
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        acc[name] = decodeURIComponent(value);
      }
      return acc;
    }, {} as Record<string, string>);
    
    console.log('Parsed cookie names:', Object.keys(cookies));
    
    const token = cookies['auth-token'] || cookies['firebase-token'] || cookies['__session'];

    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token found' }, 
        { status: 401 }
      );
    }

    return new NextResponse(token, { status: 200 });

  } catch (error) {
    console.error('Token endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve token' }, 
      { status: 500 }
    );
  }
}