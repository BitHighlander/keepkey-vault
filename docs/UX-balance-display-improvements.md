# Balance Display UX Improvements

## Problem Statement

Currently, the KeepKey Vault application hides important balance information from users:
- **Dashboard**: Shows only aggregated balances without breakdown by address type
- **Asset Page**: Only displays `balance[0]` instead of showing all balances
- **Bitcoin Specific**: BTC balances are actually a sum of 3 different xpub types (Legacy, SegWit, Native SegWit) but this is not visible to users
- **User Confusion**: Users don't know where their funds are located across different address types

## Current Implementation Issues

### Dashboard Issues
- Shows single balance per asset without any indication of breakdown
- No visual cue that the balance is an aggregate of multiple addresses
- Limited space makes it challenging to show full breakdown inline

### Asset Page Issues  
- Currently only shows first balance: `assetContext.balance` or `balance[0]`
- Has plenty of screen real estate but doesn't utilize it for balance breakdown
- Users can't see which address types hold their funds

### Data Structure
Based on the audit, the system handles:
- Multiple pubkeys per asset (stored in `assetContext.pubkeys[]`)
- Each pubkey can have different address types (especially for Bitcoin)
- Balances are stored separately but need to be aggregated for display

## Proposed UX Improvements

### 1. Dashboard - Hover Preview Component

**Visual Design:**
```
┌─────────────────────────────┐
│ BTC         0.5234 BTC      │ ← Main balance display
│             $51,234.56       │
└─────────────────────────────┘
        ↓ (on hover)
┌─────────────────────────────┐
│ Balance Breakdown           │
├─────────────────────────────┤
│ 🔑 Legacy (1...)            │
│    0.1234 BTC ($12,340.00)  │
├─────────────────────────────┤
│ 🔒 SegWit (3...)            │
│    0.2000 BTC ($20,000.00)  │
├─────────────────────────────┤
│ ⚡ Native SegWit (bc1...)    │
│    0.2000 BTC ($18,894.56)  │
└─────────────────────────────┘
```

**Implementation Features:**
- Small indicator icon (ℹ️ or ▼) next to balance to indicate breakdown available
- Smooth tooltip/popover on hover
- Shows address type labels with recognizable prefixes
- Shows both crypto and USD value per address type
- Icons to distinguish address types visually

### 2. Asset Detail Page - Comprehensive Breakdown

**Layout Design:**
```
┌─────────────────────────────────────────────┐
│  [Asset Header]                             │
│  Bitcoin (BTC)                              │
│  Total Balance: 0.5234 BTC                  │
│  Value: $51,234.56                          │
├─────────────────────────────────────────────┤
│  Balance Distribution                        │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 🔑 Legacy Address                    │   │
│  │ 1A1zP1eP5QGefi2DMPTfTL...           │   │
│  │ Balance: 0.1234 BTC                  │   │
│  │ Value: $12,340.00                    │   │
│  │ 23.6% of total                       │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 🔒 SegWit Address (P2SH)             │   │
│  │ 3J98t1WpEZ73CNmQviecrnyiWr...       │   │
│  │ Balance: 0.2000 BTC                  │   │
│  │ Value: $20,000.00                    │   │
│  │ 38.2% of total                       │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ ⚡ Native SegWit (Bech32)            │   │
│  │ bc1qar0srrr7xfkvy5l643lydnw...      │   │
│  │ Balance: 0.2000 BTC                  │   │
│  │ Value: $18,894.56                   │   │
│  │ 38.2% of total                       │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [Action Buttons: Send | Receive | Swap]    │
└─────────────────────────────────────────────┘
```

**Features:**
- Clear section header "Balance Distribution" 
- Card for each address type with:
  - Icon and label for address type
  - Full or truncated address (with copy button)
  - Balance in crypto
  - USD value
  - Percentage of total holdings
- Visual hierarchy with cards/sections
- Color coding for different address types
- Optional: Progress bar showing distribution

### 3. Component Architecture

#### BalanceBreakdownTooltip Component (Dashboard)
```typescript
interface BalanceBreakdownTooltipProps {
  balances: Balance[];
  totalValue: number;
  symbol: string;
  networkId: string;
}

Features:
- Chakra UI Tooltip/Popover
- Triggered on hover or click (mobile)
- Formatted display with icons
- Memoized for performance
```

#### BalanceDistribution Component (Asset Page)
```typescript
interface BalanceDistributionProps {
  assetContext: AssetContext;
  balances: Balance[];
  pubkeys: Pubkey[];
}

Features:
- Full breakdown cards
- Copy address functionality  
- Percentage calculations
- Sorting options (by value, type, age)
- Expandable details per address
```

### 4. Data Requirements

**Balance Interface Enhancement:**
```typescript
interface Balance {
  address: string;
  pubkey: string;
  balance: string;
  valueUsd: number;
  addressType: 'legacy' | 'segwit' | 'native-segwit' | 'taproot' | 'default';
  label?: string; // User-friendly label
  percentage?: number; // Percentage of total
}

interface AssetContext {
  // ... existing fields
  balances: Balance[]; // ALL balances, not just [0]
  totalBalance: string; // Sum of all balances
  totalValueUsd: number; // Sum of all USD values
}
```

### 5. Implementation Plan

#### Phase 1: Data Layer
1. Update `AssetContext` to include all balances
2. Create balance aggregation utilities
3. Add address type detection logic
4. Implement percentage calculations

#### Phase 2: Dashboard Tooltip
1. Create `BalanceBreakdownTooltip` component
2. Add hover trigger to balance display
3. Style tooltip with theme consistency
4. Add mobile touch support

#### Phase 3: Asset Page Distribution
1. Create `BalanceDistribution` component
2. Update Asset.tsx to show all balances
3. Add address copy functionality
4. Implement sorting/filtering options

#### Phase 4: Polish & Testing
1. Add loading states
2. Handle edge cases (single address, zero balances)
3. Add animations/transitions
4. Mobile responsiveness testing
5. Cross-browser testing

### 6. Visual Indicators & Icons

**Address Type Icons:**
- 🔑 Legacy (P2PKH) - Traditional Bitcoin addresses starting with "1"
- 🔒 SegWit (P2SH) - Wrapped SegWit addresses starting with "3"  
- ⚡ Native SegWit (Bech32) - Modern addresses starting with "bc1"
- 🎯 Taproot - Future-proof addresses (when supported)

**Visual Cues:**
- Small (i) info icon next to aggregated balances
- Subtle animation on hover to draw attention
- Progress bars or pie charts for distribution
- Color coding: Gold tones for different intensities

### 7. Benefits

**User Benefits:**
- Complete transparency about fund location
- Better decision making for transactions
- Understanding of address type benefits
- Reduced confusion and support requests

**Technical Benefits:**
- Proper data architecture
- Reusable components
- Better debugging capability
- Foundation for future features (UTXO management)

### 8. Success Metrics

- **Clarity**: Users understand where funds are located
- **Engagement**: Increased hover interactions on dashboard
- **Support**: Reduced tickets about "missing" funds
- **Adoption**: Users actively manage different address types
- **Performance**: Tooltip renders < 100ms

### 9. Future Enhancements

- UTXO-level breakdown for advanced users
- Address labeling/naming
- Transaction history per address type
- Fee optimization based on address type
- Migration tools between address types
- Export breakdown to CSV/PDF

## Next Steps

1. Review and approve design mockups
2. Update data layer to support multiple balances
3. Implement tooltip component for dashboard
4. Implement distribution component for asset page
5. User testing and feedback iteration