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
  const requestId = Math.random().toString(36).substring(7);
  //console.log(`\n========================================`);
  //console.log(`📥 [API ${requestId}] POST /api/pairing - Request received`);
  //console.log(`📥 [API ${requestId}] Timestamp:`, new Date().toISOString());
  
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    //console.log(`🔍 [API ${requestId}] Client IP:`, ip);
    
    if (!checkRateLimit(ip)) {
      //console.log(`❌ [API ${requestId}] Rate limit exceeded for IP:`, ip);
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Try again in 60 seconds.' },
        { status: 429 }
      );
    }

    // Parse request body
    //console.log(`🔍 [API ${requestId}] Parsing request body...`);
    let body;
    try {
      body = await request.json();
      //console.log(`✅ [API ${requestId}] Body parsed successfully`);
    } catch (parseError) {
      console.error(`❌ [API ${requestId}] Failed to parse JSON body:`, parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const { deviceId, label, pubkeys } = body;
    //console.log(`🔍 [API ${requestId}] Request data:`, {
    //  deviceId: deviceId || 'MISSING',
    //  label: label || 'MISSING',
    //  pubkeysCount: Array.isArray(pubkeys) ? pubkeys.length : 'NOT_ARRAY',
    //  pubkeysType: typeof pubkeys,
    //});

    // Validation
    //console.log(`🔍 [API ${requestId}] Validating deviceId...`);
    if (!deviceId || typeof deviceId !== 'string') {
      console.error(`❌ [API ${requestId}] Invalid deviceId:`, { deviceId, type: typeof deviceId });
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }
    //console.log(`✅ [API ${requestId}] deviceId valid:`, deviceId);

    //console.log(`🔍 [API ${requestId}] Validating label...`);
    if (!label || typeof label !== 'string') {
      console.error(`❌ [API ${requestId}] Invalid label:`, { label, type: typeof label });
      return NextResponse.json(
        { success: false, error: 'label is required' },
        { status: 400 }
      );
    }
    //console.log(`✅ [API ${requestId}] label valid:`, label);

    //console.log(`🔍 [API ${requestId}] Validating pubkeys array...`);
    if (!Array.isArray(pubkeys) || pubkeys.length === 0) {
      console.error(`❌ [API ${requestId}] Invalid pubkeys:`, { 
        isArray: Array.isArray(pubkeys), 
        length: Array.isArray(pubkeys) ? pubkeys.length : 'N/A' 
      });
      return NextResponse.json(
        { success: false, error: 'pubkeys array is required and must not be empty' },
        { status: 400 }
      );
    }
    //console.log(`✅ [API ${requestId}] pubkeys array valid, length:`, pubkeys.length);

    // Validate each pubkey has required fields
    //console.log(`🔍 [API ${requestId}] Validating individual pubkeys...`);
    for (let i = 0; i < pubkeys.length; i++) {
      const pubkey = pubkeys[i];
      if (!pubkey.pubkey || !pubkey.pathMaster || !pubkey.networks) {
        console.error(`❌ [API ${requestId}] Invalid pubkey at index ${i}:`, {
          hasPubkey: !!pubkey.pubkey,
          hasPathMaster: !!pubkey.pathMaster,
          hasNetworks: !!pubkey.networks,
          sample: pubkey
        });
        return NextResponse.json(
          { success: false, error: `Invalid pubkey data at index ${i}: missing required fields` },
          { status: 400 }
        );
      }
    }
    //console.log(`✅ [API ${requestId}] All pubkeys validated successfully`);

    // Get vault URL from request
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const vaultUrl = `${protocol}://${host}`;
    //console.log(`🔍 [API ${requestId}] Vault URL:`, vaultUrl);

    // Create pairing
    //console.log(`🔐 [API ${requestId}] Creating pairing in storage...`);
    const result = await pairingStorage.createPairing(
      deviceId,
      label,
      pubkeys,
      vaultUrl
    );

    //console.log(`✅ [API ${requestId}] Pairing created successfully!`);
    //console.log(`✅ [API ${requestId}] Code:`, result.code);
    //console.log(`✅ [API ${requestId}] Expires at:`, new Date(result.expiresAt).toISOString());
    //console.log(`========================================\n`);

    return NextResponse.json({
      success: true,
      code: result.code,
      expiresAt: result.expiresAt,
      expiresIn: result.expiresIn,
    });
  } catch (error: any) {
    console.error(`❌ [API ${requestId}] POST /api/pairing error:`, error);
    console.error(`❌ [API ${requestId}] Error stack:`, error.stack);
    //console.log(`========================================\n`);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
