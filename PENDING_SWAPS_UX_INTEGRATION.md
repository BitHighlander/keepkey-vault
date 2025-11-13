# Pending Swaps UX Integration - KeepKey Vault

**Date**: November 13, 2025  
**Status**: ✅ COMPLETE  
**Version**: vault v4

## Overview

Integrated the durable pending swaps tracking system into the KeepKey Vault UI, providing users with real-time visibility into their in-progress trades across the entire application.

## Features Implemented

### 1. **Dashboard Integration** ✅

**Location**: `/components/dashboard/Dashboard.tsx`

#### Pending Swaps Section
- **Visual Design**: Dedicated section showing all pending swaps  
- **Card Layout**: Each swap shows:
  - From → To asset icons
  - Amount and symbols (e.g., "0.005 ETH → RUNE")
  - Status badge (⏳ PENDING or ⚡ N confirmations)
  - TX hash (truncated with middle ellipsis)
  - Integration name (thorchain, mayachain, etc.)
  - Timestamp
- **Interactivity**: Click to navigate to sell asset page
- **Styling**: Orange/amber theme to highlight in-progress state

#### Asset Badges
- **"↗ Pending" Badge**: Shows on assets being sold
- **"↙ Pending" Badge**: Shows on assets being bought
- **Tooltip**: Hover shows amount pending (e.g., "0.005 ETH pending out")
- **Position**: Next to asset symbol in token cards

#### Donut Chart Enhancement
- **Pending Debits**: Tracked per asset for future overlay
- **Total Counter**: Shows count of active pending swaps
- **Data Structure**: Enhanced with `pendingDebits` field

### 2. **Asset Page Integration** ✅

**Location**: `/components/asset/Asset.tsx`

#### Dedicated Pending Swaps Section
- **Conditional Rendering**: Only shows if asset has pending swaps
- **Direction Indicator**: 
  - "↗ Selling" for outgoing swaps
  - "↙ Buying" for incoming swaps
- **Status Badges**:
  - Yellow "⏳ PENDING" for unconfirmed
  - Blue "⚡ N confirmations" for confirming
- **TX Links**: Clickable transaction hashes opening in blockchain explorer
- **Outbound TX**: Shows Thorchain outbound transaction (when available)
- **Copy Buttons**: Copy TX hash to clipboard
- **Timestamps**: Shows when swap was initiated

### 3. **Pending Swaps Hook** ✅

**Location**: `/hooks/usePendingSwaps.ts`

#### Custom React Hook
```typescript
const { 
  pendingSwaps,
  loading,
  getPendingForAsset,
  getDebitsForAsset,
  getCreditsForAsset,
  refresh
} = usePendingSwaps({
  address: userAddresses[0],
  autoRefresh: true,
  refreshInterval: 30000
});
```

#### Features:
- **Auto-refresh**: Updates every 30 seconds
- **Address Filtering**: Fetches swaps for user's addresses
- **API Key Support**: Can query by API key for multi-device
- **Helper Functions**:
  - `getPendingForAsset(caip)` - Get swaps for specific asset
  - `getDebitsForAsset(caip)` - Get pending outgoing amount
  - `getCreditsForAsset(caip)` - Get pending incoming amount
  - `getTotalPendingValue()` - Get total value of all pending swaps
  - `refresh()` - Manual refresh trigger

## User Experience Flow

### Scenario: User Makes a Swap

1. **Initiate Swap** on `/swap` page
   - User builds and broadcasts swap transaction
   - Swap is saved to MongoDB with user's API key

2. **Dashboard View** (http://localhost:3000)
   - **Pending Swaps Section** appears with the new swap
   - Shows: ETH → RUNE, ⏳ PENDING, TX hash
   - **ETH Token Card** shows "↗ Pending" badge
   - **RUNE Token Card** shows "↙ Pending" badge

3. **Asset Page View** (click on ETH card)
   - **Pending Swaps Section** shows:
     - "↗ Selling" indicator
     - Amount: 0.005 ETH → RUNE
     - TX hash with explorer link
     - Status: ⏳ PENDING
     - Via: thorchain
     - Timestamp

4. **Real-time Updates** (auto-refresh every 30s)
   - Status changes to ⚡ 1 confirmation
   - Then ⚡ 2, ⚡ 3, etc.
   - Eventually shows outbound TX hash
   - Moves to completed (removed from dashboard)

## Visual Design

### Color Scheme
- **Pending Swaps**: Orange/Amber theme (#FF8C00, #FFA500)
- **Outgoing Badge**: Orange "↗ Pending"
- **Incoming Badge**: Green "↙ Pending"
- **Status - Pending**: Yellow "⏳ PENDING"
- **Status - Confirming**: Blue "⚡ N confirmations"

### Layout
- **Dashboard**: Section appears between network cards and tokens
- **Asset Page**: Section appears before wallet information
- **Cards**: Consistent rounded corners, hover effects
- **Icons**: Asset icons for both sell/buy assets
- **Typography**: Monospace for TX hashes, timestamps

## API Integration

### Endpoints Used
```typescript
GET /api/v1/api/swaps/pending?address={address}
GET /api/v1/api/swaps/pending?apiKey={apiKey}
GET /api/v1/api/swaps/pending/stats/summary
```

### Request Flow
1. Vault loads → `usePendingSwaps` hook initializes
2. Hook fetches user's addresses from Pioneer SDK
3. Makes API call to pending swaps endpoint
4. Updates state with fetched swaps
5. Auto-refreshes every 30 seconds
6. Components reactively update UI

## Explorer Links

### Supported Networks
- **Ethereum**: etherscan.io
- **BSC**: bscscan.com
- **Polygon**: polygonscan.com
- **Avalanche**: snowtrace.io
- **Base**: basescan.org
- **Optimism**: optimistic.etherscan.io
- **Arbitrum**: arbiscan.io
- **Bitcoin**: blockstream.info
- **Litecoin**: blockchair.com/litecoin
- **Thorchain**: viewblock.io/thorchain
- **Mayachain**: mayascan.org

### Link Types
- **Inbound TX**: Sell asset transaction (initial broadcast)
- **Outbound TX**: Buy asset transaction (Thorchain/Maya swaps)

## Testing

### Manual Testing Steps

1. **Start Services**:
   ```bash
   # Terminal 1: Pioneer Server
   cd projects/pioneer/services/pioneer-server
   bun src/server.ts
   
   # Terminal 2: KeepKey Vault
   cd projects/keepkey-vault
   bun run dev
   ```

2. **View Dashboard**:
   - Open http://localhost:3000
   - Look for "⏳ Pending Swaps" section
   - Verify swap cards show correctly

3. **Check Asset Pages**:
   - Click on any asset involved in a swap
   - Verify "Pending Swaps" section appears
   - Click TX hash to open explorer
   - Verify copy button works

4. **Verify Auto-Refresh**:
   - Wait 30 seconds
   - Check if confirmations update
   - Verify status changes reflect

### Current Test Data

With the server running, there are:
```json
{
  "total": 7,
  "byStatus": {
    "pending": 3,
    "confirming": 3,
    "completed": 1
  },
  "byIntegration": {
    "thorchain": 7
  }
}
```

## Code Changes Summary

### New Files
- ✅ `/hooks/usePendingSwaps.ts` - React hook for fetching/managing swaps

### Modified Files
- ✅ `/components/dashboard/Dashboard.tsx` - Added pending swaps section and badges
- ✅ `/components/asset/Asset.tsx` - Added pending swaps section to asset pages

### Dependencies
- No new dependencies required
- Uses existing Chakra UI components
- Integrates with Pioneer SDK context

## Future Enhancements

Potential improvements:
1. **Swap Progress Bar**: Visual indicator of confirmation progress
2. **Swap Cancellation**: For certain protocols that support it
3. **Swap History Tab**: Dedicated page for all swap history
4. **Push Notifications**: Alert when swaps complete
5. **Estimated Time**: Show ETA based on confirmation count
6. **Failed Swap Recovery**: Retry mechanism for failed swaps

## Summary

✅ **Pending swaps fully integrated into vault UX**  
✅ **Real-time visibility on dashboard and asset pages**  
✅ **Explorer links for all transactions**  
✅ **Auto-refreshing status updates**  
✅ **Clean, consistent visual design**  
✅ **Production-ready implementation**  

Users can now **always see their trades in progress** throughout the vault interface! 🎉

