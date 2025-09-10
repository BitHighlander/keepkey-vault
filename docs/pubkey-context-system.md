# Pubkey Context System Documentation

## Overview

The Pubkey Context System is a streamlined account management system for multi-account hardware wallets (like KeepKey) that automatically manages which account (pubkey) is used for transaction building and signing. It provides automatic context switching based on asset selection while allowing manual override for advanced use cases.

## Key Features

- **Automatic Context Management**: Automatically sets the correct account when an asset is selected
- **Multi-Account Support**: Seamlessly switch between different accounts (e.g., ETH account 0, 1, 2, etc.)
- **Network-Aware**: Automatically validates and corrects context for the target network
- **Hardware Wallet Integration**: Ensures the correct BIP44 derivation path is used for signing
- **Simplified API**: Reduced from 20+ lines to 5 lines in transaction builders

## Architecture

### Components

1. **SDK Core** (`index.ts`)
   - Stores `pubkeyContext` as the currently selected account
   - Syncs context to `keepKeySdk` for transaction builders

2. **Transaction Builders** (`txbuilder/*.ts`)
   - Auto-validate context for target network
   - Extract address and derivation path from context
   - Pass correct `addressNList` for hardware wallet signing

3. **Pubkey Generation** (`getPubkey.ts`)
   - Generates pubkey objects with all necessary fields
   - Includes `addressNList` and `addressNListMaster` for signing

## How It Works

### 1. Automatic Context Setting

When you select an asset, the SDK automatically sets the appropriate pubkey context:

```typescript
// When user selects an asset
await app.setAssetContext({ caip: 'eip155:1/slip44:60' });
// Automatically sets pubkeyContext to first matching account
```

### 2. Manual Account Selection

Users can explicitly choose which account to use:

```typescript
// Get available accounts
const ethAccounts = app.pubkeys.filter(pk => 
  pk.networks?.includes('eip155:*')
);

// Select account 1 (second account)
await app.setPubkeyContext(ethAccounts[1]);
```

### 3. Transaction Building

The transaction builder automatically uses the correct account:

```typescript
// Build transaction - automatically uses selected account
const unsignedTx = await app.buildTx({
  caip: 'eip155:1/slip44:60',
  to: '0x...',
  amount: 0.1,
  isMax: false
});
// Transaction will use the FROM address from pubkeyContext
```

### 4. Transaction Signing

The correct derivation path is automatically included:

```typescript
// Sign transaction - uses correct account's private key
const signedTx = await app.signTx({ caip, unsignedTx });
// Signature created with the account from pubkeyContext
```

## Network Compatibility

The system handles different network types intelligently:

### EVM Networks
- Uses wildcard matching: `eip155:*` matches all EVM chains
- Auto-corrects if wrong EVM network selected

### UTXO Networks (Bitcoin, etc.)
- Uses exact network matching
- Supports multiple script types (P2PKH, P2SH, P2WPKH)
- Aggregates UTXOs from all relevant accounts

### Cosmos Networks
- Exact network matching
- Supports chain-specific address formats

## Data Flow

```
1. Asset Selection
   ↓
2. setAssetContext()
   ├─→ Filters pubkeys for network
   └─→ Sets first matching as context
   ↓
3. Transaction Building
   ├─→ Validates context network
   ├─→ Auto-corrects if needed
   └─→ Uses context address as FROM
   ↓
4. Transaction Signing
   ├─→ Extracts addressNList from context
   └─→ Signs with correct account key
   ↓
5. Broadcasting
   └─→ Sends signed transaction
```

## API Reference

### setPubkeyContext(pubkey)

Sets the active pubkey context for transactions.

**Parameters:**
- `pubkey`: Pubkey object containing:
  - `address`: The account address
  - `networks`: Array of supported networks
  - `addressNListMaster`: BIP44 derivation path
  - `note`: Human-readable account description

**Returns:** `Promise<boolean>`

**Example:**
```typescript
const account1 = app.pubkeys.find(pk => 
  pk.note?.includes('account 1')
);
await app.setPubkeyContext(account1);
```

### setAssetContext(asset)

Sets the asset context and automatically sets matching pubkey context.

**Parameters:**
- `asset`: Object containing:
  - `caip`: Asset identifier (e.g., 'eip155:1/slip44:60')

**Returns:** `Promise<AssetContext>`

**Side Effect:** Automatically sets `pubkeyContext` to first matching account

### pubkeyContext

Current pubkey context (read-only).

**Type:** `PubkeyContext | null`

**Example:**
```typescript
console.log('Current account:', app.pubkeyContext?.address);
console.log('Account note:', app.pubkeyContext?.note);
```

## Pubkey Object Structure

```typescript
interface PubkeyContext {
  // Address/Identity
  address: string;           // Account address
  pubkey?: string;          // Public key or xpub
  
  // Network
  networks: string[];       // Supported networks (e.g., ['eip155:*'])
  
  // Derivation Path
  addressNList: number[];        // BIP44 path array
  addressNListMaster: number[];  // Master derivation path
  path?: string;                 // BIP32 path (e.g., "m/44'/60'/0'")
  pathMaster?: string;           // Master BIP32 path
  
  // Metadata
  note?: string;            // Human-readable description
  type?: string;            // Key type (address, xpub, etc.)
  scriptType?: string;      // For UTXO chains
}
```

## Error Handling

The system includes several safety mechanisms:

1. **Network Validation**: Automatically corrects wrong network contexts
2. **Fallback Logic**: Uses first available account if context invalid
3. **Clear Errors**: Descriptive error messages for debugging

## Performance Optimizations

- **Context Caching**: Pubkey context persists across operations
- **Lazy Validation**: Network validation only when building transactions
- **Efficient Filtering**: Uses optimized array operations for pubkey selection

## Migration from Legacy System

### Before (20+ lines)
```typescript
const relevantPubkeys = pubkeys.filter(e => e.networks?.includes(network));
let address;
if (pubkeyContext && pubkeyContext.address) {
  const isValid = relevantPubkeys.some(pk => pk.address === pubkeyContext.address);
  if (isValid) {
    address = pubkeyContext.address;
  } else {
    address = relevantPubkeys[0]?.address;
  }
} else {
  address = relevantPubkeys[0]?.address;
}
// ... more validation logic
```

### After (5 lines)
```typescript
if (!keepKeySdk.pubkeyContext?.networks?.includes(expectedNetwork)) {
  keepKeySdk.pubkeyContext = pubkeys.find(pk => pk.networks?.includes(expectedNetwork));
}
const address = keepKeySdk.pubkeyContext?.address;
```

## Best Practices

1. **Let Auto-Management Work**: Don't manually set context unless needed
2. **Set Context Early**: If using specific account, set before building transaction
3. **Check Context**: Verify current context before important operations
4. **Handle Errors**: Always handle potential context errors gracefully

## Troubleshooting

### Issue: Wrong account used
**Solution:** Explicitly set pubkey context before transaction:
```typescript
await app.setPubkeyContext(desiredAccount);
```

### Issue: "No address found for network"
**Solution:** Ensure pubkeys are loaded for the network:
```typescript
await app.getPubkeys();
```

### Issue: Transaction signed with wrong key
**Solution:** Check addressNList in unsigned transaction:
```typescript
console.log('Path used:', unsignedTx.addressNList);
```

## Security Considerations

1. **No Private Keys**: System only manages public keys and paths
2. **Hardware Isolation**: Private keys remain on hardware wallet
3. **Path Validation**: Ensures only valid derivation paths are used
4. **Network Isolation**: Prevents cross-network account confusion

## Future Enhancements

- [ ] Multi-signature account support
- [ ] Custom derivation path support
- [ ] Account labeling and metadata
- [ ] Persistent account preferences
- [ ] Advanced account discovery