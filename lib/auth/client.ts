// Client-side versions of auth functions
import { User } from '@/lib/db/schema';

/**
 * Client-side function to get the user session
 */
export async function getClientUser(): Promise<User | null> {
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
}

/**
 * Client-side function to get the team session
 */
export async function getClientTeam() {
  try {
    const response = await fetch('/api/auth/team');
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Error getting team session:', error);
    return null;
  }
}