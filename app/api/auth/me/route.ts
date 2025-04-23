import { getSessionUser } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(null, { status: 401 });
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error getting user session:', error);
    return NextResponse.json(
      { error: 'Failed to get user session' },
      { status: 500 }
    );
  }
}