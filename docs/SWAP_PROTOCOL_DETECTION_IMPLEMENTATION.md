# Swap Protocol Detection - Implementation Guide

## Summary of Findings

### How Protocol Selection Works

**Quote Flow**:
1. Vault calls `app.swap()` → Pioneer SDK
2. Pioneer SDK calls `pioneer.Quote()` → Pioneer Server
3. Pioneer Server calls `router.quote()` → Pioneer Router
4. Pioneer Router checks **all integrations** in parallel:
   - `thorchain` (line 82-84)
   - `mayachain` (line 81)
   - `rango`
   - `osmosis`
5. Router returns **ALL quotes** that support both assets
6. **First quote** in array is auto-selected by SDK (line 1046 in pioneer-sdk/src/index.ts)

**The Problem**:
- Router decides thor vs maya based on **asset support matching**
- Both integrations checked in parallel
- **Integration name** is buried in response structure
- Vault UI never sees which protocol was actually chosen
- UI hardcodes "THORChain" everywhere

### Quote Response Structure

```typescript
// From pioneer-router/src/index.ts:322
quotes.push({
  integration,  // ← THIS is "thorchain" or "mayachain"!
  quote: integrationQuote
});

// What Vault receives (line 1033-1046 in pioneer-sdk):
result = await this.pioneer.Quote(quote);
result = result.data;
let selected = result[0];  // First quote auto-selected
let txs = selected.quote.txs;  // ← No protocol info here!
```

**CRITICAL**: The `integration` field contains `"thorchain"` or `"mayachain"` but Vault doesn't check it!

## Maya Protocol Assets

### Currently Supported (from /mayachain/pools)

**Native Assets**:
- `BTC.BTC` - Bitcoin
- `ETH.ETH` - Ethereum
- `DASH.DASH` - Dash
- `MAYA.CACAO` - Native Maya token
- `THOR.RUNE` - THORChain RUNE
- `KUJI.KUJI` - Kujira
- `XRD.XRD` - Radix
- `ZEC.ZEC` - Zcash

**Arbitrum Tokens** (ARB chain):
- `ARB.ETH` - Arbitrum ETH
- `ARB.USDC-0XAF88D065E77C8CC2239327C5EDB3A432268E5831`
- `ARB.USDT-0XFD086BC7CD5C481DCC9C85EBE478A1C0B69FCBB9`
- `ARB.WBTC-0X2F2A2543B76A4166549F7AAB2E75BEF0AEFC5B0F`
- `ARB.WSTETH-0X5979D7B546E38E414F7E9822514BE443A4800529`
- `ARB.YUM-0X9F41B34F42058A7B74672055A5FAE22C4B113FD1`
- `ARB.LEO-0X93864D81175095DD93360FFA2A529B8642F76A6E` (decimals: 3)
- `ARB.GLD-0XAFD091F140C21770F4E5D53D26B2859AE97555AA`

**Ethereum ERC20 Tokens**:
- `ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48`
- `ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7`
- `ETH.WSTETH-0X7F39C581F595B53C5CB19BD0B3F8DA6C935E2CA0`
- `ETH.MOCA-0X53312F85BBA24C8CB99CFFC13BF82420157230D3`

### CAIP Mapping for Maya

From `mayachain/src/index.ts:39-53`:

```typescript
const caipToMayachainName: Record<string, string> = {
  // Native Layer 1 Assets
  'bip122:000000000019d6689c085ae165831e93/slip44:0': 'BTC.BTC',
  'eip155:1/slip44:60': 'ETH.ETH',
  'bip122:000007d91d1254d60e2dd1ae58038307/slip44:5': 'DASH.DASH',
  'cosmos:mayachain-mainnet-v1/slip44:931': 'MAYA.CACAO',
  'eip155:42161/slip44:60': 'ARB.ETH',

  // TODO: Add ERC20 and Arbitrum token mappings
  // Example format:
  // 'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
};
```

**Current Gap**: Only 5 assets mapped, but Maya supports 18+ pools. Need to add ERC20 and Arbitrum token mappings.

### Maya vs THORChain Asset Differences

| Asset | THORChain | Maya | Notes |
|-------|-----------|------|-------|
| BTC | ✅ | ✅ | Both support |
| ETH | ✅ | ✅ | Both support |
| DASH | ❌ | ✅ | **Maya only** |
| CACAO | ❌ | ✅ | **Maya native** |
| RUNE | ✅ (native) | ✅ (traded) | THORChain native, Maya pool |
| XRP | ✅ | ❌ | **THORChain only** |
| ZEC | ❌ | ✅ | **Maya only** |
| KUJI | ❌ | ✅ | **Maya only** |
| XRD | ❌ | ✅ | **Maya only** |
| Arbitrum | ❌ | ✅ | **Maya has ARB pools** |
| Base | ✅ | ❌ | **THORChain only** |
| AVAX | ✅ | ❌ | **THORChain only** |
| BSC | ✅ | ❌ | **THORChain only** |

**Key Insight**: Maya and THORChain have **overlapping but different** asset support. Router chooses based on what supports both assets.

## Implementation Plan

### Phase 1: Add Protocol Detection to Quote Response

**File**: `projects/keepkey-vault/src/components/swap/Swap.tsx`

**Step 1**: Extract protocol from quote response (line ~1046)

```typescript
// Current code (line 1033-1046)
let result = await this.pioneer.Quote(quote);
result = result.data;
let selected = result[0];

// ADD PROTOCOL DETECTION:
const protocol = selected.integration || 'thorchain';  // Extract integration name
console.log('🔍 [Swap] Protocol selected:', protocol);

// Store in state for UI
tx.protocol = protocol;  // Pass through to transaction
```

**Step 2**: Add protocol to swap state (line ~195-200)

```typescript
const [quote, setQuote] = useState<any>(null);
const [protocol, setProtocol] = useState<'thorchain' | 'mayachain'>('thorchain');

// When quote is received (line ~684-686):
if (quoteData && quoteData.expected_amount_out) {
  setQuote(quoteData);

  // ADD: Detect protocol from quote metadata
  // Note: Currently thorchain.ts only calls THORNode
  // Need to check if Pioneer API returns protocol info
  const detectedProtocol = quoteData.protocol || 'thorchain';
  setProtocol(detectedProtocol);
  console.log('📊 [Swap] Protocol detected:', detectedProtocol);
}
```

**Step 3**: Update vault verification to show protocol (line ~1896-1906)

```typescript
// Current hardcoded text:
<Text fontSize="sm" color="gray.300" mb={3}>
  Your funds will be sent to the THORChain router/vault address below.
  This is the official THORChain vault that will process your swap.
</Text>

// REPLACE WITH DYNAMIC:
const protocolName = protocol === 'mayachain' ? 'Maya Protocol' : 'THORChain';
const nodeUrl = protocol === 'mayachain'
  ? 'https://mayanode.mayachain.info/mayachain/inbound_addresses'
  : 'https://thornode.ninerealms.com/thorchain/inbound_addresses';

<Text fontSize="sm" color="gray.300" mb={3}>
  Your funds will be sent to the {protocolName} router/vault address below.
  This is the official {protocolName} vault that will process your swap.
</Text>

<Text fontSize="sm" color="gray.400">{protocolName} Vault:</Text>

<Button href={nodeUrl}>
  Verify Vault Address ({protocolName})
</Button>
```

### Phase 2: Expand Maya Asset Support

**File**: `projects/pioneer/modules/intergrations/mayachain/src/index.ts`

**Current state** (line 39-53): Only 5 CAIP mappings
**Need to add**: 13+ more assets from active Maya pools

```typescript
const caipToMayachainName: Record<string, string> = {
  // Native Layer 1 Assets
  'bip122:000000000019d6689c085ae165831e93/slip44:0': 'BTC.BTC',
  'eip155:1/slip44:60': 'ETH.ETH',
  'bip122:000007d91d1254d60e2dd1ae58038307/slip44:5': 'DASH.DASH',
  'cosmos:mayachain-mainnet-v1/slip44:931': 'MAYA.CACAO',
  'cosmos:thorchain-mainnet-v1/slip44:931': 'THOR.RUNE',
  'eip155:42161/slip44:60': 'ARB.ETH',

  // Ethereum ERC20 Tokens
  'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
  'eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7': 'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
  'eip155:1/erc20:0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': 'ETH.WSTETH-0X7F39C581F595B53C5CB19BD0B3F8DA6C935E2CA0',
  'eip155:1/erc20:0x53312f85bba24c8cb99cffc13bf82420157230d3': 'ETH.MOCA-0X53312F85BBA24C8CB99CFFC13BF82420157230D3',

  // Arbitrum Tokens
  'eip155:42161/erc20:0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'ARB.USDC-0XAF88D065E77C8CC2239327C5EDB3A432268E5831',
  'eip155:42161/erc20:0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 'ARB.USDT-0XFD086BC7CD5C481DCC9C85EBE478A1C0B69FCBB9',
  'eip155:42161/erc20:0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 'ARB.WBTC-0X2F2A2543B76A4166549F7AAB2E75BEF0AEFC5B0F',
  'eip155:42161/erc20:0x5979d7b546e38e414f7e9822514be443a4800529': 'ARB.WSTETH-0X5979D7B546E38E414F7E9822514BE443A4800529',
  'eip155:42161/erc20:0x9f41b34f42058a7b74672055a5fae22c4b113fd1': 'ARB.YUM-0X9F41B34F42058A7B74672055A5FAE22C4B113FD1',
  'eip155:42161/erc20:0x93864d81175095dd93360ffa2a529b8642f76a6e': 'ARB.LEO-0X93864D81175095DD93360FFA2A529B8642F76A6E',
  'eip155:42161/erc20:0xafd091f140c21770f4e5d53d26b2859ae97555aa': 'ARB.GLD-0XAFD091F140C21770F4E5D53D26B2859AE97555AA',

  // Additional Native Assets (if CAIP identifiers known)
  // TODO: Find CAIP identifiers for KUJI, XRD, ZEC
};
```

### Phase 3: Update Vault Quote Service

**File**: `projects/keepkey-vault/src/services/thorchain.ts`

**Step 1**: Rename to `swapProtocols.ts` to be protocol-agnostic

**Step 2**: Implement getMayaQuote() parallel to getThorchainQuote()

```typescript
export const MAYANODE_URL = 'https://mayanode.mayachain.info';
export const MAYA_MIDGARD_URL = 'https://midgard.mayachain.info';
export const MAYA_TRACKER_URL = 'https://track.mayachain.info';

// Maya Protocol assets (from pools API)
const MAYA_ASSETS: Record<string, string> = {
  'BTC': 'BTC.BTC',
  'ETH': 'ETH.ETH',
  'DASH': 'DASH.DASH',
  'CACAO': 'MAYA.CACAO',
  'RUNE': 'THOR.RUNE',
  'KUJI': 'KUJI.KUJI',
  'XRD': 'XRD.XRD',
  'ZEC': 'ZEC.ZEC',
  // Add token mappings similar to THORCHAIN_ASSETS
};

export async function getMayaQuote(
  fromAsset: string,
  toAsset: string,
  amount: number,
  destinationAddress?: string
): Promise<SwapQuote | null> {
  try {
    const fromMayaAsset = MAYA_ASSETS[fromAsset];
    const toMayaAsset = MAYA_ASSETS[toAsset];

    if (!fromMayaAsset || !toMayaAsset) {
      console.error('Asset not supported on Maya Protocol:', { fromAsset, toAsset });
      return null;
    }

    console.log('🔍 [Maya] Preparing quote request:', {
      fromAsset,
      toAsset,
      fromMayaAsset,
      toMayaAsset,
      amount
    });

    const params = new URLSearchParams({
      from_asset: fromMayaAsset,
      to_asset: toMayaAsset,
      amount: amount.toString(),
      ...(destinationAddress && { destination: destinationAddress }),
    });

    const url = `${MAYANODE_URL}/mayachain/quote/swap?${params.toString()}`;
    console.log('📡 [Maya] Fetching quote from:', url);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Maya] Failed to fetch quote:', {
        status: response.status,
        error: errorText
      });
      throw new Error(`Maya quote failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ [Maya] Quote response:', data);

    if (!data.expected_amount_out || data.expected_amount_out === "0") {
      throw new Error('Invalid Maya quote: zero output amount');
    }

    // Add protocol identifier to response
    data.protocol = 'mayachain';

    return data;
  } catch (error) {
    console.error('❌ [Maya] Error fetching quote:', error);
    throw error;
  }
}

export async function getMayaInboundAddress(chain: string): Promise<{ address: string; chain: string } | null> {
  try {
    const url = `${MAYANODE_URL}/mayachain/inbound_addresses`;
    console.log('🔍 [Maya] Fetching inbound addresses from:', url);

    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch Maya inbound addresses:', response.status);
      return null;
    }

    const data = await response.json();
    const inboundInfo = data.find((item: any) => item.chain === chain);

    if (inboundInfo) {
      console.log(`✅ [Maya] Found inbound address for ${chain}:`, inboundInfo.address);
      return {
        address: inboundInfo.address,
        chain: inboundInfo.chain
      };
    }

    console.error(`❌ [Maya] No inbound address found for chain: ${chain}`);
    return null;
  } catch (error) {
    console.error('Error fetching Maya inbound address:', error);
    return null;
  }
}
```

### Phase 4: Update UI Components

**File**: `projects/keepkey-vault/src/components/swap/SwapConfirm.tsx`

Add protocol display prominently:

```typescript
export const SwapConfirm = ({
  // ... existing props
  protocol = 'thorchain'  // ADD THIS PROP
}: SwapConfirmProps & { protocol?: 'thorchain' | 'mayachain' }) => {
  const protocolName = protocol === 'mayachain' ? 'Maya Protocol' : 'THORChain';
  const protocolColor = protocol === 'mayachain' ? '#9f7aea' : '#23DCC8';

  return (
    <VStack gap={8} width="full" align="stretch">
      {/* Protocol Badge */}
      <HStack justify="center" gap={2} py={2} px={4} bg="gray.800" borderRadius="md">
        <FaInfoCircle color={protocolColor} size="14" />
        <Text fontSize="sm" fontWeight="medium" color={protocolColor}>
          {protocolName}
        </Text>
      </HStack>

      {/* ... rest of component */}
    </VStack>
  );
};
```

## Testing Plan

### 1. Protocol Detection Test

```typescript
// Test that protocol is correctly detected from quote response
const testProtocolDetection = async () => {
  // Test THORChain quote
  const thorQuote = await getThorchainQuote('BTC', 'ETH', 100000000);
  expect(thorQuote.protocol).toBe('thorchain');

  // Test Maya quote
  const mayaQuote = await getMayaQuote('BTC', 'DASH', 100000000);
  expect(mayaQuote.protocol).toBe('mayachain');
};
```

### 2. UI Display Test

- [ ] Swap BTC → ETH (THORChain)
  - Verify "THORChain" shown throughout flow
  - Verify THORNode verification link
  - Verify device shows THORChain vault address

- [ ] Swap BTC → DASH (Maya only, should use Maya)
  - Verify "Maya Protocol" shown throughout flow
  - Verify MayaNode verification link
  - Verify device shows Maya vault address

- [ ] Swap BTC → CACAO (Maya native)
  - Verify Maya protocol detected
  - Verify correct vault address

### 3. Asset Coverage Test

Run swap quote requests for all Maya-supported assets and verify:
- [ ] All 18 Maya pool assets have CAIP mappings
- [ ] Router correctly identifies Maya support
- [ ] Quotes return successfully

## Deployment Checklist

- [ ] Update `mayachain/src/index.ts` with complete CAIP mappings
- [ ] Add `getMayaQuote()` to `thorchain.ts` (or rename file)
- [ ] Update Pioneer SDK to preserve `integration` field
- [ ] Add `protocol` state to Swap component
- [ ] Update all UI text to be protocol-dynamic
- [ ] Update verification links to be protocol-specific
- [ ] Add protocol badge to SwapConfirm component
- [ ] Test all Maya-only swaps (DASH, CACAO, ZEC, etc.)
- [ ] Test overlapping assets (BTC, ETH) on both protocols
- [ ] Verify vault addresses match protocol
- [ ] Update documentation

## Related Files

- `projects/pioneer/modules/intergrations/mayachain/src/index.ts` - Maya integration
- `projects/pioneer/modules/intergrations/thorchain/src/index.ts` - THORChain integration
- `projects/pioneer/modules/pioneer/pioneer-router/src/index.ts` - Quote router
- `projects/pioneer/services/pioneer-server/src/controllers/quote.controller.ts` - API endpoint
- `projects/pioneer/modules/pioneer/pioneer-sdk/src/index.ts` - SDK swap logic
- `projects/keepkey-vault/src/components/swap/Swap.tsx` - Vault swap UI
- `projects/keepkey-vault/src/components/swap/SwapConfirm.tsx` - Confirmation dialog
- `projects/keepkey-vault/src/services/thorchain.ts` - Quote service

## Notes

- Maya Protocol uses 10 decimals for CACAO (line 141 in mayachain/src/index.ts)
- THORChain uses 8 decimals for RUNE
- Both protocols use different memo formats (but both created via `createMemo()`)
- Router evaluates ALL integrations and returns best quote(s)
- SDK auto-selects first quote - no user choice currently
- Pioneer API already has `integration` field - just need to surface it to UI
