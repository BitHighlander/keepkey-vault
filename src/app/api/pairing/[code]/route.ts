import { NextRequest, NextResponse } from 'next/server';
import { pairingStorage } from '@/lib/pairing/PairingStorage';

// Rate limiting for pairing retrieval
const retrievalRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RETRIEVAL_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_RETRIEVAL_ATTEMPTS = 10; // Prevent brute force

function checkRetrievalRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = retrievalRateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    retrievalRateLimitMap.set(ip, { count: 1, resetAt: now + RETRIEVAL_RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= MAX_RETRIEVAL_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Await params as required by Next.js 15
    const { code } = await params;

    // Validate code format (8 alphanumeric characters)
    if (!/^[A-Z0-9]{8}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: 'Invalid pairing code format' },
        { status: 400 }
      );
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRetrievalRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Try again later.' },
        { status: 429 }
      );
    }

    // Retrieve pairing data
    let pairingData;
    try {
      pairingData = await pairingStorage.consumePairing(code);
    } catch (error: any) {
      if (error.message === 'ALREADY_USED') {
        return NextResponse.json(
          { success: false, error: 'Pairing code already used' },
          { status: 410 } // 410 Gone
        );
      }
      throw error;
    }

    if (!pairingData) {
      return NextResponse.json(
        { success: false, error: 'Pairing code not found or expired' },
        { status: 404 }
      );
    }

    // Return full pairing data
    return NextResponse.json({
      success: true,
      data: {
        version: 1,
        deviceId: pairingData.deviceId,
        label: pairingData.label,
        timestamp: pairingData.createdAt,
        vaultUrl: pairingData.vaultUrl,
        pubkeys: pairingData.pubkeys,
      },
    });
  } catch (error: any) {
    console.error('GET /api/pairing/[code] error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
