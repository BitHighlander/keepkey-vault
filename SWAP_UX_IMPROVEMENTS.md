# Swap UX & Event System Improvements

## Overview
Applied comprehensive swap monitoring and event system improvements from Pioneer to KeepKey Vault swap dialogs.

## Key Improvements Applied

### 1. Enhanced Event System with Granular Status Tracking

**New Swap Event Types:**
- `swap:initiated` - Swap transaction created
- `swap:confirming` - Input transaction confirming
- `swap:output_detected` (NEW) - Output transaction first detected 🎯
- `swap:output_confirming` (NEW) - Output transaction gaining confirmations ⏳
- `swap:output_confirmed` (NEW) - Output transaction fully confirmed ✅
- `swap:completed` - Legacy completion event (same as output_confirmed)
- `swap:failed` - Swap failed ❌
- `swap:refunded` - Swap refunded by protocol 🔄

**Benefits:**
- Users get real-time updates at each stage of the swap
- Clear visual feedback with emoji indicators
- Better understanding of swap progress

### 2. Dual Confirmation Tracking

**Input Transaction Confirmations:**
- Tracks confirmations of the user's input transaction
- Shows when input is being confirmed on source blockchain

**Output Transaction Confirmations (NEW):**
- Tracks confirmations of the swap output transaction
- Visual progress bar showing confirmation progress
- Displays X / Y required confirmations
- Animated progress indicator

**Example:**
```
Output Confirmations: 3 / 6 required
[████████░░░░░░░░] 50%
```

### 3. Enhanced Error Handling & User Guidance

**Error Information Display:**
- Error type and severity badges (ERROR, WARNING)
- User-friendly error messages (not just technical jargon)
- Actionable guidance - tells users what to do next
- Technical details available for debugging

**Common Error Scenarios:**
- Confirmation timeout - "Transaction taking longer than usual to confirm"
- Protocol timeout - "THORChain didn't complete swap after X minutes"
- Malformed transaction - "Transaction wasn't recognized as valid swap"
- Refund due to invalid memo - "Swap refunded because memo was incorrect"

**Example Error Display:**
```
⚠️ MEMO_INVALID [ERROR]

Your swap was refunded due to an invalid memo format.

💡 Action Required:
The memo must start with "=:" or "SWAP:". Please use the exact
memo provided by the swap quote.

Technical Details: Swap refunded by thorchain protocol
```

### 4. Protocol Integration Details

**Integration Information:**
- Clear display of protocol used (THORChain, Maya Protocol)
- Protocol-specific status information
- Integration-aware explorer links

**Example:**
- THORChain swaps link to ViewBlock THORChain explorer
- Maya swaps link to MayaScan explorer
- Proper formatting of protocol names (thorchain → THORChain)

### 5. Enhanced Timeline Information

**Timing Details:**
- Created timestamp with elapsed time ("5m ago", "2h ago")
- Output detected timestamp (when outbound tx first appears)
- Duration calculations for swap completion

**Example:**
```
Timeline:
Created: 1/11/2026, 3:35:06 PM (5m ago)
🎯 Output Detected: 1/11/2026, 3:38:12 PM
```

### 6. Transaction Links & Copy Functions

**Inbound Transaction:**
- Full transaction hash display
- One-click copy to clipboard
- Direct link to blockchain explorer

**Outbound Transaction:**
- Full outbound transaction hash
- Copy function
- Protocol-specific explorer links
- Only shown when output is detected

### 7. Visual Improvements

**Status Badges:**
- Color-coded by state (yellow=pending, blue=confirming, green=complete, red=failed, orange=refund)
- Emoji indicators for quick recognition
- Consistent styling across components

**Progress Indicators:**
- Animated progress bars for confirmation tracking
- Smooth transitions as confirmations increase
- Color-themed to match app design

**Card Enhancements:**
- Compact view shows essential info
- Detailed modal for comprehensive information
- Hover states with purple theme accent
- Clear visual hierarchy

### 8. Swap Memo Display

**Memo Information:**
- Shows the THORChain/Maya swap memo used
- Formatted in monospace font for clarity
- Color-coded styling
- Helps users verify correct memo was used

## Components Updated

### 1. TransactionDetailDialog.tsx
- Enhanced swap metadata section
- Added all new event system fields
- Improved error display
- Added confirmation progress tracking

### 2. PendingSwapsPopup.tsx
- Updated status badge component with new states
- Enhanced SwapDetailsModal with comprehensive info
- Improved SwapCardCompact with progress indicators
- Added output detection notifications

## User Experience Benefits

1. **Transparency**: Users see exactly what's happening at each step
2. **Confidence**: Clear progress indicators reduce anxiety
3. **Guidance**: Actionable error messages help users resolve issues
4. **Speed**: Real-time updates keep users informed
5. **Troubleshooting**: Technical details available when needed

## Technical Implementation

### Data Structure
Swap metadata now includes:
```typescript
{
  status: 'pending' | 'confirming' | 'output_detected' | 'output_confirming' | 'output_confirmed' | 'completed' | 'failed' | 'refunded',
  confirmations: number,                    // Input tx confirmations
  outboundConfirmations: number,            // Output tx confirmations
  outboundRequiredConfirmations: number,    // Required confirmations for output
  integration: 'thorchain' | 'mayachain',
  createdAt: Date,
  outputDetectedAt?: Date,
  error?: {
    type: string,
    severity: 'ERROR' | 'WARNING',
    userMessage: string,
    actionable: string,
    message: string,
    context?: any
  }
}
```

### Event Flow
1. User initiates swap → `swap:initiated`
2. Input tx confirms → `swap:confirming`
3. Protocol processes → (waiting)
4. Output detected → `swap:output_detected` 🎯
5. Output confirming → `swap:output_confirming` ⏳
6. Output confirmed → `swap:output_confirmed` ✅
7. Completion → `swap:completed`

## Integration with Pioneer Backend

The vault now expects swap events from Pioneer server with this enhanced structure:

```typescript
interface SwapEvent {
  type: 'swap:initiated' | 'swap:confirming' | 'swap:output_detected' |
        'swap:output_confirming' | 'swap:output_confirmed' | 'swap:completed' |
        'swap:failed' | 'swap:refunded';
  txHash: string;
  timestamp: number;
  sellAsset: { caip: string; symbol: string; amount: string };
  buyAsset: { caip: string; symbol: string; expectedAmount?: string };
  integration: string;
  confirmations?: number;
  outboundConfirmations?: number;
  outboundRequiredConfirmations?: number;
  thorchainData?: {
    swapStatus: string;
    inboundTxHash?: string;
    outboundTxHash?: string;
  };
  error?: { /* error structure */ };
}
```

## Testing Checklist

- [ ] Swap initiated event displays correctly
- [ ] Input confirmation progress shows
- [ ] Output detection triggers visual update
- [ ] Output confirmation progress bar works
- [ ] Error messages display with actionable guidance
- [ ] Transaction links work correctly
- [ ] Copy functions work
- [ ] Timeline information is accurate
- [ ] Status badges show correct colors/emojis
- [ ] Modal displays all fields correctly

## Future Enhancements

1. Toast notifications for state changes
2. Sound effects for major events (output detected, completed)
3. Estimated time remaining calculations
4. Historical swap analytics
5. Multi-hop swap visualization
6. Streaming swap progress (for THORChain streaming swaps)

---

**Last Updated:** 2026-01-11
**Applied From:** Pioneer swap-monitor.service.ts + swap-events.service.ts improvements
