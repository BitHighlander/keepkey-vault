# Chat Assistant & Tutorial System - Quick Reference

## 🎯 What You Can Ask

### Portfolio & Balances
- "What's my balance?"
- "Show me my top assets"
- "How much Bitcoin do I have?"
- "What's my total portfolio value?"

### Navigation
- "Show me my Bitcoin"
- "Open Ethereum"
- "Go to dashboard"
- "Take me to the send page"

### Help & Tutorials
- **"Start tutorial"** - Launch interactive tutorial for current page
- "What can I do here?" - Get help for current page
- "What is the Send button?" - Explain specific UI elements
- "Tell me about KeepKey Vault" - Learn about the project

### Features & Information
- "Tell me about features"
- "Tell me about security"
- "What pages are available?"

## 🎓 Tutorial System

### Starting Tutorials
1. **From Chat**: Type "Start tutorial" or "Show me around"
2. **Quick Start**: Click the 🎓 button in chat header
3. **Badge**: Look for gold "Tutorial" badge on chat button

### During Tutorials
- **Next**: Click "Next →" or press Enter
- **Previous**: Click "← Previous" (available after step 1)
- **Skip**: Click "Skip Tutorial" anytime
- **Finish**: On last step, click "🎉 Finish Tutorial"

### Tutorial Features
- 🎯 **Spotlight Effect**: Highlighted element with pulsing blue border
- 📍 **Smart Positioning**: Tooltip auto-positions for best visibility
- 📜 **Auto-Scroll**: Elements scroll into view automatically
- 📊 **Progress**: Shows "Step X of Y" for tracking

## 🗺️ Available Tutorials

### Dashboard Tutorial (5 steps)
1. Total Portfolio Value explanation
2. Donut Chart interaction guide
3. Network Cards overview
4. Top Assets list navigation
5. Chat Assistant introduction

### Asset Page Tutorial (4 steps)
1. Asset Overview explanation
2. Primary Actions (Send/Receive/Swap)
3. Balance Distribution details
4. Managing Addresses

### Send Page Tutorial (4 steps)
1. Recipient Address input
2. Amount and Max button
3. Network Fee selection
4. Review & Sign process

### Receive Page Tutorial (3 steps)
1. Receiving Address display
2. QR Code scanning
3. Verify on Device security

### Swap Page Tutorial (4 steps)
1. Asset Selection (From/To)
2. Amount Entry
3. Quote Comparison
4. Execute Swap

## 🔧 For Developers

### Adding data-tutorial-id to Elements

```tsx
// Example: Dashboard total value
<Box data-tutorial-id="total-portfolio-value">
  ${totalValue}
</Box>

// Example: Send button
<Button data-tutorial-id="send-button" onClick={handleSend}>
  Send
</Button>
```

### Element IDs by Page

#### Dashboard
- `total-portfolio-value` - USD value display
- `donut-chart` - Asset allocation chart
- `network-cards` - Network grid
- `top-assets-list` - Assets scrollable list
- `refresh-button` - Refresh portfolio button
- `settings-button` - Settings access
- `chat-bubble` - Chat assistant button

#### Asset Page
- `asset-header` - Asset name and icon
- `asset-value-usd` - USD value
- `send-button` - Send action
- `receive-button` - Receive action
- `swap-button` - Swap action
- `refresh-button` - Refresh balance
- `balance-distribution` - Balance breakdown
- `add-path-button` - Add new address
- `pubkey-list` - Address list

#### Send Page
- `recipient-input` - Destination address field
- `amount-input` - Amount to send field
- `max-button` - Fill max amount
- `fee-selector` - Fee level selection
- `memo-input` - Optional memo field
- `review-button` - Review transaction
- `sign-button` - Sign and send

#### Receive Page
- `qr-code` - QR code display
- `address-display` - Text address
- `copy-button` - Copy address
- `verify-button` - Verify on device
- `address-selector` - Choose address

#### Swap Page
- `from-asset` - Source asset
- `to-asset` - Destination asset
- `from-amount` - Amount input
- `to-amount` - Estimated output
- `swap-quotes` - Rate comparison
- `execute-swap` - Execute button

### Testing Tutorial Elements

```typescript
// Test if element can be found
const element = document.getElementById('send-button') ||
  document.querySelector('[data-tutorial-id="send-button"]') ||
  document.querySelector('.send-button');

if (element) {
  console.log('✅ Element found:', element);
  console.log('📍 Position:', element.getBoundingClientRect());
} else {
  console.error('❌ Element not found');
}
```

### Creating New Tutorial Steps

```typescript
{
  order: 1,
  title: 'Step Title',
  description: 'Explain what the user is looking at and why it matters',
  elementId: 'element-id', // Optional - element to highlight
  action: 'Tell user what to try (e.g., "Click to copy address")', // Optional
  nextStep: 'What happens after this step', // Optional, shown on last step
}
```

## 🎨 UI Elements

### Chat Button
- **Location**: Bottom-right corner (fixed position)
- **Size**: 60px circle
- **Color**: Blue (#3B82F6)
- **Animation**: Pulsing every 2 seconds
- **Badge**: Gold "Tutorial" badge when available

### Chat Dialog
- **Size**: 400px × 600px
- **Position**: Bottom-right with 24px margin
- **Header**: Title + Venice.ai label + Tutorial button + Close
- **Messages**: Scrollable with auto-scroll
- **Input**: Bottom bar with Send button

### Tutorial Overlay
- **Background**: Dark (80% opacity)
- **Spotlight**: Pulsing blue border (3px)
- **Tooltip**: White box with blue border
- **Positioning**: Smart (top/bottom/left/right)
- **Animation**: Smooth fade-in (300ms)

## 📱 Responsive Behavior

### Mobile (< 768px)
- Chat dialog: Full width, reduced height
- Tutorial tooltip: Adjusts to viewport
- Touch-friendly buttons (min 44px tap targets)

### Tablet (768px - 1024px)
- Chat dialog: 90% width, max 400px
- Tutorial tooltip: Optimal positioning maintained

### Desktop (> 1024px)
- Chat dialog: Fixed 400px width
- Tutorial tooltip: Full positioning flexibility

## 🔐 Privacy Features

### Venice.ai Integration
- ✅ No tracking IDs
- ✅ No user data collection
- ✅ Conversations not stored
- ✅ Privacy-first model (qwen3-4b)
- ✅ Server-side prompts (tamper-proof)

### Security Measures
- ✅ Function whitelisting
- ✅ Input sanitization
- ✅ No private key exposure
- ✅ Rate limiting
- ✅ Secure execution environment

## 🧪 Quick Testing Commands

```bash
# Test Venice.ai inference
pnpm run test:inference

# Test chat functions
pnpm run test:chat:functions

# Run dev server
pnpm run dev

# Build for production
pnpm run build
```

## 📊 Quick Debug Checklist

### Tutorial Not Starting
- [ ] Check browser console for errors
- [ ] Verify `tutorialSteps` exist for page
- [ ] Confirm tutorial hook initialized
- [ ] Check if element exists in DOM

### Element Not Highlighting
- [ ] Verify `elementId` matches element
- [ ] Check element has `id` or `data-tutorial-id`
- [ ] Confirm element is visible (not hidden)
- [ ] Try manual element lookup in console

### Chat Not Responding
- [ ] Check Venice.ai endpoint reachable
- [ ] Verify Pioneer SDK initialized
- [ ] Check network tab for API calls
- [ ] Try simple query first ("Hello")

## 🆘 Common Issues & Fixes

### Issue: "Element not found"
**Fix**: Add explicit `data-tutorial-id` attribute to element

### Issue: Tooltip off-screen
**Fix**: System auto-detects viewport boundaries, but ensure element is visible

### Issue: Tutorial won't start
**Fix**: Refresh page to reinitialize tutorial hook

### Issue: Chat button not showing
**Fix**: Check z-index conflicts, ensure ChatPopup component rendered

## 📞 Get Help

- **Documentation**: See `CHAT_TUTORIAL_SYSTEM.md`
- **Issues**: Create GitHub issue with `chat-assistant` tag
- **Questions**: Ask in KeepKey Stack repository

## 🚀 Quick Start (For Users)

1. Look for chat bubble (💬) in bottom-right corner
2. Click to open
3. Type "Start tutorial" or click 🎓 button
4. Follow the interactive guide
5. Ask questions anytime!

## 🎯 Quick Start (For Developers)

1. Add page context to `pageContext.ts`
2. Add tutorial steps
3. Add `data-tutorial-id` to UI elements
4. Update `PAGE_REGISTRY` and `detectCurrentPage()`
5. Test tutorial flow
6. Done! 🎉

---

**Need more details?** See `CHAT_TUTORIAL_SYSTEM.md` for comprehensive documentation.
