import { NextRequest, NextResponse } from 'next/server';
import { pairingStorage } from '@/lib/pairing/PairingStorage';

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Try again in 60 seconds.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { deviceId, label, pubkeys } = body;

    // Validation
    if (!deviceId || typeof deviceId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    if (!label || typeof label !== 'string') {
      return NextResponse.json(
        { success: false, error: 'label is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(pubkeys) || pubkeys.length === 0) {
      return NextResponse.json(
        { success: false, error: 'pubkeys array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate each pubkey has required fields
    for (const pubkey of pubkeys) {
      if (!pubkey.pubkey || !pubkey.pathMaster || !pubkey.networks) {
        return NextResponse.json(
          { success: false, error: 'Invalid pubkey data: missing required fields' },
          { status: 400 }
        );
      }
    }

    // Get vault URL from request
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const vaultUrl = `${protocol}://${host}`;

    // Create pairing
    const result = await pairingStorage.createPairing(
      deviceId,
      label,
      pubkeys,
      vaultUrl
    );

    return NextResponse.json({
      success: true,
      code: result.code,
      expiresAt: result.expiresAt,
      expiresIn: result.expiresIn,
    });
  } catch (error: any) {
    console.error('POST /api/pairing error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
