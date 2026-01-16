# Swap Protocol Audit - THORChain vs Maya Protocol Issue

## Executive Summary

**CRITICAL FINDING**: The swap UI displays "THORChain" for verification but may execute swaps through Maya Protocol, creating a serious user trust and transparency issue.

## The Problem

User experienced:
1. UI showed quote/vault verification for **THORChain**
2. Device prompted for **THORChain** address verification
3. Transaction actually executed through **Maya Protocol**

This is a **major UX and security concern** - users must know which protocol they're using.

## Root Cause Analysis

### 1. Protocol Selection Happens in Pioneer API (Backend)

**Location**: `projects/pioneer/modules/pioneer/pioneer-sdk/src/index.ts:1033`

```typescript
// The swap() function calls Pioneer API's Quote endpoint
result = await this.pioneer.Quote(quote);
result = result.data;

// Pioneer API returns quote with protocol selection ALREADY MADE
let selected = result[0];  // First quote is auto-selected
let txs = selected.quote.txs;
```

**The Issue**:
- Protocol (THORChain vs Maya) is selected **server-side** by Pioneer API
- Vault UI has **no visibility** into which protocol was chosen
- Quote response doesn't clearly indicate protocol
- UI displays hardcoded "THORChain" references

### 2. Vault UI Hardcodes THORChain References

**Location**: `projects/keepkey-vault/src/components/swap/Swap.tsx`

**Problematic Code**:

```typescript
// Line 1896-1897: Hardcoded "THORChain" text
<Text fontSize="sm" color="gray.300" mb={3}>
  Your funds will be sent to the THORChain router/vault address below.
  This is the official THORChain vault that will process your swap.
</Text>

// Line 1906: "THORChain Vault" label
<Text fontSize="sm" color="gray.400">THORChain Vault:</Text>

// Line 1927-1928: THORNode verification link
<Button
  href="https://thornode.ninerealms.com/thorchain/inbound_addresses"
  ...
>
  Verify Vault Address (THORNode)
</Button>
```

**The Problem**:
- These labels are **static** and don't reflect actual protocol
- If Maya is selected, user sees "THORChain" but gets Maya
- Verification link points to THORNode API (wrong for Maya swaps)

### 3. Quote Service Only Uses THORChain

**Location**: `projects/keepkey-vault/src/services/thorchain.ts`

```typescript
export const THORNODE_URL = 'https://thornode.ninerealms.com';
export const MIDGARD_URL = 'https://midgard.ninerealms.com';

// Only THORChain assets mapped
const THORCHAIN_ASSETS: Record<string, string> = THORCHAIN_POOLS.reduce(...)

// Maya assets defined but NEVER USED
const MAYA_ASSETS: Record<string, string> = {
  'BTC': 'BTC.BTC',
  'ETH': 'ETH.ETH',
  'RUNE': 'THOR.RUNE',
  'CACAO': 'MAYA.CACAO',
};
```

**The Issue**:
- `MAYA_ASSETS` mapping exists but is **completely unused**
- No Maya-specific quote fetching
- `getThorchainQuote()` is the only quote method
- Yet Pioneer API can return Maya quotes!

## Critical Vulnerabilities

### 1. **User Trust Violation**
- User approves "THORChain" transaction
- Device shows THORChain address for verification
- Actual execution uses different protocol (Maya)
- **Breaks informed consent principle**

### 2. **Address Verification Mismatch**
```typescript
// User verifies vault address shown in UI
// But if protocol is Maya, this should be Maya vault!
{vaultAddress && (
  <Code>
    {vaultAddress}  // Is this THORChain or Maya vault?
  </Code>
)}
```

### 3. **Wrong Verification Links**
```typescript
// Links to THORNode API for ALL swaps
<Button href="https://thornode.ninerealms.com/thorchain/inbound_addresses">
  Verify Vault Address (THORNode)
</Button>
```

If Maya protocol is used, this link shows **wrong vault addresses**.

### 4. **Missing Protocol Context Throughout Flow**

**Swap.tsx:1834** - Dialog title
```typescript
verificationStep === 'vault' ? 'Verify THORChain Router' :
```

**Swap.tsx:1853** - Approval text
```typescript
'Checking if THORChain router is approved to spend your tokens...'
```

**Swap.tsx:2098** - Memo display
```typescript
{quote?.memo && (
  <Box bg="gray.800" p={3}>
    <Text>This memo contains your swap instructions</Text>
    // BUT: THORChain memo format ≠ Maya memo format!
  </Box>
)}
```

## Required Fixes

### 1. **Add Protocol Detection to Quote Response**

Pioneer API must return protocol identifier:

```typescript
interface QuoteResponse {
  quote: {
    protocol: 'thorchain' | 'maya';  // ADD THIS
    txs: Transaction[];
    // ... rest
  }
}
```

### 2. **Dynamic Protocol Display in UI**

```typescript
// Detect protocol from quote
const protocol = quote?.quote?.protocol || 'thorchain';
const protocolName = protocol === 'maya' ? 'Maya Protocol' : 'THORChain';
const vaultApiUrl = protocol === 'maya'
  ? 'https://mayanode.mayachain.info/mayachain/inbound_addresses'
  : 'https://thornode.ninerealms.com/thorchain/inbound_addresses';

// Use in UI
<Text>
  Your funds will be sent to the {protocolName} router/vault address below.
</Text>

<Button href={vaultApiUrl}>
  Verify Vault Address ({protocolName})
</Button>
```

### 3. **Add Protocol to Verification Flow**

```typescript
// SwapConfirm.tsx - Show protocol prominently
<VStack gap={3}>
  <HStack gap={2} color="blue.400">
    <FaInfoCircle />
    <Text fontSize="sm" fontWeight="medium">
      Protocol: {protocolName}
    </Text>
  </HStack>

  <Text fontSize="sm" color="gray.300">
    This swap will execute via {protocolName}
  </Text>
</VStack>
```

### 4. **Implement getMayaQuote() Parallel to getThorchainQuote()**

```typescript
// thorchain.ts
export const MAYANODE_URL = 'https://mayanode.mayachain.info';
export const MAYA_MIDGARD_URL = 'https://midgard.mayachain.info';

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
      throw new Error(`Maya quote failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ [Maya] Quote response:', data);

    return data;
  } catch (error) {
    console.error('❌ [Maya] Error fetching quote:', error);
    throw error;
  }
}
```

### 5. **Add Protocol Field to Swap Payload**

```typescript
// Pioneer SDK index.ts
this.swap = async function (swapPayload) {
  // ... existing code ...

  let result = await this.pioneer.Quote(quote);
  result = result.data;

  // Extract protocol from response
  let selected = result[0];
  let protocol = selected.quote.protocol || 'thorchain';  // Default to thorchain

  console.log(tag, `Selected protocol: ${protocol}`);

  // Pass protocol info through to UI
  for (let i = 0; i < txs.length; i++) {
    let tx = txs[i];
    tx.protocol = protocol;  // ADD THIS

    // ... rest of build logic
  }
}
```

### 6. **Update Device Verification to Show Protocol**

```typescript
// Swap.tsx - Device verification dialog
<Box bg="purple.900/30" borderWidth="1px" borderColor="purple.700/50" p={4}>
  <VStack align="start" gap={2}>
    <HStack gap={2}>
      <FaShieldAlt color="#9f7aea" />
      <Text fontSize="md" fontWeight="bold">
        {protocolName} Swap
      </Text>
    </HStack>

    <Text fontSize="sm" color="gray.300">
      Your funds will be sent to the {protocolName} router/vault address below.
      This is the official {protocolName} vault that will process your swap.
    </Text>
  </VStack>
</Box>
```

## Testing Checklist

- [ ] Verify THORChain swaps show "THORChain" throughout flow
- [ ] Verify Maya swaps show "Maya Protocol" throughout flow
- [ ] Test THORNode verification link for THORChain swaps
- [ ] Test MayaNode verification link for Maya swaps
- [ ] Confirm device shows correct protocol name during address verification
- [ ] Validate vault address matches protocol (THORChain vault vs Maya vault)
- [ ] Test memo validation for both protocols (formats differ)
- [ ] Verify approval flows show correct router for each protocol

## Priority: CRITICAL

**Impact**: HIGH - User trust, security, informed consent
**Urgency**: HIGH - Current behavior misleads users about transaction details
**Complexity**: MEDIUM - Requires Pioneer API changes + UI updates

## Recommended Approach

1. **Phase 1**: Add protocol detection to Pioneer API Quote response
2. **Phase 2**: Update Vault UI to dynamically show protocol
3. **Phase 3**: Implement getMayaQuote() for client-side quotes
4. **Phase 4**: Add protocol-specific verification links and help text
5. **Phase 5**: Full E2E testing of both protocols

## Related Files

- `projects/keepkey-vault/src/components/swap/Swap.tsx` - Main swap component
- `projects/keepkey-vault/src/components/swap/SwapConfirm.tsx` - Confirmation dialog
- `projects/keepkey-vault/src/services/thorchain.ts` - Quote service (needs Maya equivalent)
- `projects/pioneer/modules/pioneer/pioneer-sdk/src/index.ts` - Pioneer SDK swap logic
- Pioneer API Quote endpoint (server-side, not in this repo)

## Notes

- Maya Protocol and THORChain use similar but **distinct** memo formats
- Vault addresses are **completely different** between protocols
- Router addresses differ between protocols
- Inbound address APIs have different endpoints
- Both protocols supported but Maya currently "invisible" to user
