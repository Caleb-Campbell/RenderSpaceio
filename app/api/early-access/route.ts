import { NextRequest, NextResponse } from 'next/server';

// In a real implementation, this would connect to your database
// This is just a placeholder for demonstration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;
    
    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }
    
    // Here you would typically:
    // 1. Store the email in your database
    // 2. Send a confirmation email
    // 3. Connect to your marketing platform (e.g., Mailchimp)
    console.log('Early access sign-up received:', email);
    
    // For demo purposes, just return success
    return NextResponse.json(
      { success: true, message: 'Successfully added to early access list' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing early access sign-up:', error);
    return NextResponse.json(
      { error: 'Failed to process sign-up' },
      { status: 500 }
    );
  }
}