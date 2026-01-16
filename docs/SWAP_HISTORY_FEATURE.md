# Swap History Feature

## Overview
Added a comprehensive swap history and audit feature to the KeepKey Vault swap page. Users can now track, review, and audit all their swap transactions with detailed information.

## Features Implemented

### 1. Tab System on Swap Page
- Added "Swap" and "History" tabs to the swap interface
- Badge on History tab shows count of active pending swaps
- Smooth tab switching with visual feedback
- Maintains THORChain branding and UI consistency

### 2. Swap History Component (`SwapHistory.tsx`)
A fully featured swap history viewer with:

#### Status Tracking
- **Active Swaps**: Pending and confirming transactions
- **Completed Swaps**: Successfully finished transactions
- **Failed/Refunded Swaps**: Transactions that failed or were refunded

#### Detailed Swap Information
Each swap entry displays:
- Asset icons and symbols (from/to)
- Amounts being swapped
- Transaction status with color-coded badges
- Transaction hashes with explorer links
- Integration name (THORChain, Maya, etc.)
- Confirmation count for pending transactions
- Outbound transaction hash (for completed swaps)
- Creation timestamp
- Full audit trail with CAIP identifiers

#### Interactive Features
- Expandable/collapsible swap details
- One-click refresh button
- Direct links to blockchain explorers
- Grouped by status for easy navigation
- Scrollable list with max height constraint

#### Visual Design
- Color-coded status badges (yellow=pending, blue=confirming, green=completed, red=failed)
- Status icons for quick visual identification
- Dark theme matching the vault aesthetic
- Card-based layout for each swap
- Compact design that fits within the swap card

### 3. Integration with Existing Hook
- Uses the existing `usePendingSwaps` hook
- Connects to Pioneer API for real-time swap data
- Automatically fetches pending swaps on mount
- Manual refresh capability

## Files Created/Modified

### New Files
- `/projects/keepkey-vault/src/components/swap/SwapHistory.tsx` - Main history component

### Modified Files
- `/projects/keepkey-vault/src/components/swap/Swap.tsx`
  - Added tab system
  - Integrated SwapHistory component
  - Added badge showing pending swap count
  - Added conditional rendering based on active tab

## Technical Details

### Component Structure
```
Swap Component
├── Tab Buttons (Swap | History)
│   └── Badge (shows pending count)
└── Content
    ├── Swap Form (when "Swap" tab active)
    └── SwapHistory (when "History" tab active)
        ├── Header with Refresh button
        ├── Loading State
        ├── Error State
        ├── Empty State
        └── Grouped Swaps
            ├── Active Swaps
            ├── Completed Swaps
            └── Failed/Refunded Swaps
```

### Data Flow
1. `usePendingSwaps` hook fetches swap data from Pioneer API
2. `GetAddressPendingSwaps` API endpoint returns swap transactions
3. Data is grouped by status (active/completed/failed)
4. Each swap can be expanded to show full details
5. Manual refresh updates the data from the API

### Audit Capabilities
Each swap provides complete audit trail including:
- Full transaction hashes (inbound and outbound)
- CAIP identifiers for both assets
- Integration name and protocol
- Exact amounts and symbols
- Status progression (pending → confirming → completed)
- Timestamps for tracking duration
- Direct blockchain explorer links for verification

## Usage

### For Users
1. Navigate to the Swap page in KeepKey Vault
2. Click the "History" tab to view swap history
3. See badge showing count of active pending swaps
4. Expand any swap to see full details
5. Click transaction hashes to view on blockchain explorer
6. Use Refresh button to get latest status updates

### For Developers
```tsx
// The hook can be used anywhere in the app
import { usePendingSwaps } from '@/hooks/usePendingSwaps';

function MyComponent() {
  const { 
    pendingSwaps, 
    isLoading, 
    error,
    refreshPendingSwaps,
    getPendingForAsset,
    getDebitsForAsset,
    getCreditsForAsset
  } = usePendingSwaps();
  
  // Use the data...
}
```

## Benefits

1. **Transparency**: Users can see exactly what's happening with their swaps
2. **Audit Trail**: Complete transaction history with all details
3. **Real-time Updates**: Manual refresh gets latest status
4. **User Experience**: Clean, intuitive interface matching vault design
5. **Developer Friendly**: Reusable hook and component structure
6. **Security**: Users can verify transactions on blockchain explorers
7. **Trust**: Full visibility into swap process builds confidence

## Future Enhancements

Potential additions:
- Auto-refresh with configurable interval
- Filtering by asset or date range
- Export history to CSV
- Push notifications for swap status changes
- Estimated completion time for pending swaps
- Swap analytics and statistics
- Integration with other DEX protocols beyond THORChain
- Swap cancellation capability (where supported)

## Testing

To test the feature:
1. Navigate to swap page in keepkey-vault
2. Verify tabs are visible (Swap | History)
3. Perform a swap transaction
4. Switch to History tab
5. Verify swap appears in Active Swaps section
6. Expand swap to see details
7. Click transaction hash to verify explorer link works
8. Use Refresh button to update status

## Notes

- The component is designed to work within the existing card layout
- Maintains THORChain branding and color scheme (#23DCC8)
- Uses Chakra UI v3 components for consistency
- Follows KeepKey Vault's dark theme design
- No fallbacks or mock data (per workspace rules)
- All credentials handled via Pioneer SDK context

