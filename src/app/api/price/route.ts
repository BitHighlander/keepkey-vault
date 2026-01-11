import { NextResponse } from 'next/server';

/**
 * Price API Endpoint - Proxy to Pioneer Server
 *
 * This endpoint proxies price requests to the Pioneer server's /api/v1/market/info endpoint.
 * It serves as the single source of truth for price data in the vault frontend.
 *
 * @route GET /api/price?caip={caip}
 * @param caip - The CAIP identifier for the asset (e.g., "bip122:000000000019d6689c085ae165831e93/slip44:0")
 * @returns {price: number} - The current price in USD
 *
 * @example
 * GET /api/price?caip=bip122:000000000019d6689c085ae165831e93/slip44:0
 * Response: {"price": 106653, "caip": "bip122:000000000019d6689c085ae165831e93/slip44:0", "success": true}
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const caip = searchParams.get('caip');

  // Validate input
  if (!caip) {
    return NextResponse.json(
      { error: 'Missing caip parameter', success: false },
      { status: 400 }
    );
  }

  // Get Pioneer server URL from environment
  const pioneerSpec = process.env.NEXT_PUBLIC_PIONEER_URL || 'http://localhost:9001/spec/swagger.json';
  const PIONEER_URL = pioneerSpec.replace('/spec/swagger.json', '');

  //console.log(`💰 [Price API] Fetching price for ${caip} from ${PIONEER_URL}`);

  try {
    // Call Pioneer server's market info endpoint
    // This endpoint accepts an array of CAIPs and returns prices in the same order
    const response = await fetch(`${PIONEER_URL}/api/v1/market/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify([caip])
    });

    if (!response.ok) {
      console.error(`❌ [Price API] Pioneer server error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        {
          error: `Pioneer server error: ${response.statusText}`,
          success: false,
          caip
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract price from response
    // Pioneer returns: {"data": [106653], "success": true}
    const price = data.data?.[0] ?? 0;

    const duration = Date.now() - startTime;
    console.log(`✅ [Price API] Price fetched in ${duration}ms: ${caip} = $${price.toLocaleString()}`);

    return NextResponse.json({
      price,
      caip,
      success: true,
      timestamp: new Date().toISOString(),
      responseTime: duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Price API] Error fetching price (${duration}ms):`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch price',
        success: false,
        caip,
        price: 0 // Fallback to 0 on error
      },
      { status: 500 }
    );
  }
}

/**
 * Batch Price API Endpoint - Fetch multiple prices at once
 *
 * @route POST /api/price
 * @body {caips: string[]} - Array of CAIP identifiers
 * @returns {prices: Record<string, number>} - Map of CAIP to price
 *
 * @example
 * POST /api/price
 * Body: {"caips": ["bip122:000000000019d6689c085ae165831e93/slip44:0", "eip155:1/slip44:60"]}
 * Response: {"prices": {"bip122:...": 106653, "eip155:...": 3500}, "success": true}
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const caips: string[] = body.caips;

    if (!caips || !Array.isArray(caips) || caips.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid caips array', success: false },
        { status: 400 }
      );
    }

    // Get Pioneer server URL from environment
    const pioneerSpec = process.env.NEXT_PUBLIC_PIONEER_URL || 'http://localhost:9001/spec/swagger.json';
    const PIONEER_URL = pioneerSpec.replace('/spec/swagger.json', '');

    console.log(`💰 [Price API Batch] Fetching ${caips.length} prices from ${PIONEER_URL}`);

    // Call Pioneer server's market info endpoint with all CAIPs
    const response = await fetch(`${PIONEER_URL}/api/v1/market/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(caips)
    });

    if (!response.ok) {
      console.error(`❌ [Price API Batch] Pioneer server error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        {
          error: `Pioneer server error: ${response.statusText}`,
          success: false
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform array response into CAIP -> price map
    const prices: Record<string, number> = {};
    caips.forEach((caip, index) => {
      prices[caip] = data.data?.[index] ?? 0;
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [Price API Batch] ${caips.length} prices fetched in ${duration}ms`);

    return NextResponse.json({
      prices,
      success: true,
      timestamp: new Date().toISOString(),
      responseTime: duration,
      count: caips.length
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Price API Batch] Error fetching prices (${duration}ms):`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch prices',
        success: false,
        prices: {}
      },
      { status: 500 }
    );
  }
}
