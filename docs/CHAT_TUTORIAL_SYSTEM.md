# Chat Assistant & Tutorial System Integration

## Overview

This document describes the comprehensive integration of the Venice.ai-powered chat assistant with an interactive tutorial/onboarding system for the KeepKey Vault application.

## System Components

### 1. Page Context System (`src/lib/chat/pageContext.ts`)

**Purpose**: Provides comprehensive descriptions of all pages and UI elements for the AI to understand and guide users.

**Key Features**:
- Detailed page descriptions for every route in the app
- UI element registry with descriptions, locations, and actions
- Tutorial step definitions for each page
- Context-aware help text generation
- Element lookup and highlighting capabilities

**Page Contexts Defined**:
- **Dashboard** - Portfolio overview with donut chart and network cards
- **Asset Detail** - Individual asset management and actions
- **Send Transaction** - Form for sending cryptocurrency
- **Receive** - Address display with QR code
- **Swap** - DEX integration for exchanging assets
- **Settings** - Application configuration

### 2. Tutorial Highlight System (`src/components/chat/TutorialHighlight.tsx`)

**Purpose**: Creates an interactive spotlight system that highlights UI elements and guides users through features.

**Key Features**:
- **Spotlight Effect**: Dark overlay with highlighted UI element
- **Pulsing Border**: Animated border around target element
- **Smart Positioning**: Tooltip auto-positions based on element location (top/bottom/left/right)
- **Step Navigation**: Previous/Next buttons with progress indicator
- **Skip Functionality**: Allow users to exit tutorial anytime
- **Smooth Scrolling**: Auto-scrolls to highlighted elements
- **Element Detection**: Multiple fallback methods to find elements (ID, data attribute, class)

**Hook**: `useTutorial`
- Manages tutorial state and progression
- Controls active step, navigation, and completion
- Provides methods: `startTutorial`, `nextStep`, `previousStep`, `skipTutorial`

### 3. Enhanced Chat Functions (`src/lib/chat/functions.ts`)

**New Functions Added**:

#### Tutorial & Help Functions
- **`startTutorial(app)`** - Starts interactive tutorial for current page
- **`getPageHelp(app)`** - Returns context-aware help for current page
- **`highlightElement(elementId, app)`** - Highlights specific UI element
- **`explainElement(elementId, app)`** - Explains what a UI element does
- **`getProjectInfo(topic?)`** - Provides information about KeepKey Vault

**Function Executor Updated** (`src/lib/chat/executor.ts`):
- Added handlers for all new tutorial and help functions
- Parameter mapping for element IDs and topics
- Integration with page context system

### 4. Enhanced Chat Popup (`src/components/chat/ChatPopup.tsx`)

**New Features**:

#### Tutorial Integration
- Detects current page and loads appropriate tutorial steps
- Exposes tutorial controls to app instance for function calls
- Shows "Tutorial" badge on chat button when tutorial is available
- Quick-start tutorial button (🎓) in chat header
- Tutorial overlay renders on top of all other content

#### Context-Aware Welcome Messages
- Welcome message adapts to current page
- Shows key features for the page
- Suggests relevant actions ("Start tutorial", "What can I do here?")

#### Venice.ai Privacy Label
- Chat header shows "Powered by Venice.ai (privacy-first)"
- Reminds users of privacy-preserving AI

#### Tutorial Controls
- `app.startTutorial()` - Start tutorial programmatically
- `app.highlightElement(elementId)` - Highlight specific elements
- Tutorial state managed through React hooks

## Tutorial System Architecture

### Tutorial Flow

```
User clicks chat button
  ↓
Chat opens with context-aware welcome
  ↓
User asks: "Start tutorial" or clicks 🎓 button
  ↓
AI calls startTutorial() function
  ↓
TutorialHighlight component activates
  ↓
Spotlight highlights first element
  ↓
User navigates through steps (Previous/Next)
  ↓
Tutorial completes or user skips
```

### Element Highlighting System

1. **Element Detection**:
   - Try `document.getElementById(elementId)`
   - Fallback to `querySelector([data-tutorial-id])`
   - Fallback to `querySelector(.elementId)`

2. **Position Calculation**:
   - Get element's `getBoundingClientRect()`
   - Calculate optimal tooltip position (top/bottom/left/right)
   - Consider viewport boundaries

3. **Spotlight Effect**:
   - Dark overlay (rgba(0,0,0,0.8))
   - Pulsing blue border around element
   - Clear area showing the actual element
   - Smooth fade-in animation

4. **Auto-scroll**:
   - `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`

## Adding Tutorials to New Pages

### Step 1: Define Page Context

Add your page to `src/lib/chat/pageContext.ts`:

```typescript
export const YOUR_PAGE: PageContext = {
  id: 'your-page',
  name: 'Your Page Name',
  path: '/your-path',
  description: 'What this page does',
  purpose: 'Why users come here',
  keyFeatures: [
    'Feature 1',
    'Feature 2',
    'Feature 3',
  ],
  elements: [
    {
      id: 'element-id',
      name: 'Element Name',
      description: 'What this element is',
      location: 'Where to find it',
      type: 'button', // or 'input', 'card', 'section', 'link', 'chart'
      action: 'What happens when clicked',
    },
    // ... more elements
  ],
  tutorialSteps: [
    {
      order: 1,
      title: 'Step Title',
      description: 'Step description',
      elementId: 'element-id', // Optional - element to highlight
      action: 'User action to perform', // Optional
      nextStep: 'What happens next', // Optional
    },
    // ... more steps
  ],
};
```

### Step 2: Add to Registry

```typescript
export const PAGE_REGISTRY: Record<string, PageContext> = {
  // ... existing pages
  yourPage: YOUR_PAGE,
};
```

### Step 3: Update detectCurrentPage Function

```typescript
export function detectCurrentPage(pathname: string): PageContext | null {
  // ... existing detection
  if (pathname === '/your-path') {
    return YOUR_PAGE;
  }
  return null;
}
```

### Step 4: Add data-tutorial-id Attributes

In your component JSX, add `data-tutorial-id` to elements:

```tsx
<Button
  data-tutorial-id="send-button"
  onClick={handleSend}
>
  Send
</Button>
```

## Chat Function Integration

### How the AI Uses Functions

When a user asks a question, the Venice.ai model analyzes the intent and returns JSON:

```json
{
  "intent": "action_tutorial",
  "functions": ["startTutorial"],
  "parameters": {},
  "content": "Starting the tutorial for this page..."
}
```

The executor then:
1. Looks up the function in `FUNCTION_REGISTRY`
2. Calls it with appropriate parameters
3. Returns the result to the chat
4. Formats the response for the user

### Example User Interactions

**User**: "Start tutorial"
- AI detects intent: `action_tutorial`
- Calls: `startTutorial(app)`
- Result: Tutorial overlay activates

**User**: "What can I do here?"
- AI detects intent: `query_help`
- Calls: `getPageHelp(app)`
- Result: Returns page-specific help text

**User**: "What is the Send button?"
- AI detects intent: `query_element`
- Calls: `explainElement('send-button', app)`
- Result: Returns explanation of send button

**User**: "Tell me about KeepKey Vault"
- AI detects intent: `query_project`
- Calls: `getProjectInfo()`
- Result: Returns project overview

## Testing the System

### Manual Testing Checklist

1. **Chat Button**:
   - [ ] Chat button appears in bottom-right corner
   - [ ] Pulsing animation works
   - [ ] "Tutorial" badge shows on pages with tutorials
   - [ ] Click opens chat dialog

2. **Welcome Messages**:
   - [ ] Welcome message changes per page
   - [ ] Key features listed for each page
   - [ ] Suggestions relevant to page

3. **Tutorial Badge**:
   - [ ] Badge appears on dashboard
   - [ ] Badge appears on asset pages
   - [ ] No badge on pages without tutorials

4. **Tutorial Activation**:
   - [ ] Clicking 🎓 starts tutorial
   - [ ] Asking "start tutorial" starts tutorial
   - [ ] Overlay appears with spotlight

5. **Tutorial Navigation**:
   - [ ] Elements highlighted correctly
   - [ ] Tooltip positioned correctly
   - [ ] Previous/Next buttons work
   - [ ] Skip button exits tutorial
   - [ ] Auto-scroll to elements works

6. **Element Highlighting**:
   - [ ] Pulsing border animates
   - [ ] Spotlight effect visible
   - [ ] Element accessible underneath

7. **Chat Functions**:
   - [ ] "What can I do here?" returns help
   - [ ] "Tell me about features" returns features
   - [ ] "Show me Bitcoin" navigates to Bitcoin
   - [ ] "What's my balance?" returns balances

### Automated Testing

Run the test suite:

```bash
# Test chat functions
pnpm run test:chat:functions

# Test Venice.ai integration
pnpm run test:inference
```

## Next Steps & Future Enhancements

### Immediate Next Steps
1. Add `data-tutorial-id` attributes to key Dashboard elements
2. Add `data-tutorial-id` attributes to Asset page elements
3. Test tutorial flow on all pages
4. Refine tutorial step descriptions based on user feedback

### Future Enhancements

#### 1. Progress Tracking
- Store tutorial completion status in localStorage
- Show progress badges (3/5 steps completed)
- Skip completed tutorials automatically

#### 2. Interactive Actions
- Allow tutorial to perform actions (e.g., "Click this button for you")
- Wait for user to complete actions before proceeding
- Validate user actions

#### 3. Contextual Tips
- Show tips based on user behavior
- "Pro tip" popups for advanced features
- First-time user detection

#### 4. Multi-page Tutorials
- Tutorials that span multiple pages
- Guide users through complete workflows
- "Send your first transaction" end-to-end tutorial

#### 5. Video Tutorials
- Embed video clips in tutorial steps
- Screen recordings of actions
- Alternative learning format

#### 6. Accessibility Improvements
- Keyboard navigation for tutorials
- Screen reader announcements
- High contrast mode for highlights

#### 7. Analytics
- Track which tutorials are started
- Monitor completion rates
- Identify confusing steps

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Chat Popup Component                    │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ Welcome Msg  │  │ Tutorial Badge │  │ Tutorial Hook  │  │
│  └──────────────┘  └────────────────┘  └────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Venice.ai Integration                     │
│  User Input → Intent Detection → Function Selection          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Function Executor                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Navigation │ Queries │ Actions │ Tutorials & Help    │  │
│  └───────────────────────────────────────────────────────┘  │
└───────┬───────────────┬────────────────┬────────────────────┘
        │               │                │
        ↓               ↓                ↓
  ┌─────────┐    ┌───────────┐   ┌──────────────────┐
  │ Pioneer │    │ Page      │   │ Tutorial         │
  │ SDK     │    │ Context   │   │ Highlight        │
  │ Actions │    │ System    │   │ Component        │
  └─────────┘    └───────────┘   └──────────────────┘
                      │                   │
                      └───────┬───────────┘
                              │
                              ↓
                      ┌───────────────┐
                      │ UI Elements   │
                      │ with data-    │
                      │ tutorial-id   │
                      └───────────────┘
```

## Privacy & Security

### Venice.ai Integration
- **Privacy-first**: No tracking IDs or user data collection
- **Server-side prompts**: System prompts injected server-side (cannot be tampered with)
- **No data persistence**: Conversations not stored
- **Open model**: Uses qwen3-4b (small, efficient, privacy-preserving)

### Security Considerations
- **No sensitive data exposure**: AI never sees private keys or seed phrases
- **Function whitelisting**: Only approved functions can be called
- **Input validation**: All user inputs sanitized
- **Rate limiting**: Server-side rate limiting on AI endpoint

## Troubleshooting

### Tutorial Not Starting
1. Check if tutorialSteps exist for current page
2. Verify `data-tutorial-id` attributes on elements
3. Check browser console for errors
4. Ensure tutorial hook is initialized

### Element Not Highlighting
1. Verify `elementId` in tutorial step matches element
2. Try adding explicit `id` attribute instead of `data-tutorial-id`
3. Check if element is rendered (not hidden/conditional)
4. Verify element is scrolled into view

### Chat Not Responding
1. Check Venice.ai API endpoint is reachable
2. Verify Pioneer SDK is initialized
3. Check browser console for errors
4. Test with simple queries first

### Function Not Executing
1. Verify function exists in FUNCTION_REGISTRY
2. Check function executor has handler for function
3. Verify parameters are passed correctly
4. Check function implementation for errors

## Contact & Support

For questions or issues:
- Create an issue in the KeepKey Stack repository
- Tag with `chat-assistant` or `tutorial-system`
- Provide browser console logs if applicable
- Include steps to reproduce

## Credits

**Built with**:
- Venice.ai - Privacy-preserving AI inference
- Pioneer SDK - KeepKey wallet integration
- Chakra UI - React component library
- React - UI framework

**Privacy-first AI**: No tracking, no data collection, user-owned experience.
