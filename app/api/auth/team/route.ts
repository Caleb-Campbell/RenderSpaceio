import { getSessionTeam } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const team = await getSessionTeam();
    
    if (!team) {
      return NextResponse.json({ team: null }, { status: 401 });
    }
    
    return NextResponse.json({ team });
  } catch (error) {
    console.error('Error getting team session:', error);
    return NextResponse.json(
      { error: 'Failed to get team session', team: null },
      { status: 500 }
    );
  }
}