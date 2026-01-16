# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

KeepKey Vault is a Next.js-based web application for the KeepKey hardware wallet ecosystem. The application provides portfolio management, swap functionality, transaction history, and multi-chain asset support.

**Tech Stack:**
- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18+, Chakra UI
- **State Management**: React Context + Hooks
- **API Integration**: Pioneer SDK (@pioneer-platform packages)
- **Build Tool**: Turbo (monorepo)

## Critical Architecture Context

### Application Structure
```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
│   ├── asset/       # Asset display & transaction components
│   ├── send/        # Send/transfer components
│   ├── swap/        # Swap functionality
│   └── ui/          # Reusable UI components
├── contexts/        # React Context providers
├── services/        # API services & integrations
├── utils/           # Utility functions
└── hooks/           # Custom React hooks
```

### Key Integration Points

**Pioneer SDK Integration:**
- All blockchain interactions go through Pioneer SDK
- NEVER create mock data or fake endpoints
- NEVER bypass Pioneer SDK for blockchain operations
- Services layer handles all Pioneer API communication

**Component Architecture:**
- Server Components by default (App Router)
- Client Components only when needed ('use client')
- Shared UI components in `src/components/ui/`
- Theme utilities in `*.theme.ts` files

## Next.js Best Practices for KeepKey Vault

### Priority System

All code should follow these performance priorities from Vercel Engineering:

| Priority | Category | Impact | When to Apply |
|----------|----------|--------|---------------|
| **CRITICAL** | Eliminating Waterfalls | Largest performance gains | Data fetching, async operations |
| **CRITICAL** | Bundle Size | Time to Interactive, LCP | Imports, third-party libraries |
| **HIGH** | Server-Side Performance | Response times | Server Components, API routes |
| **MEDIUM-HIGH** | Client Data Fetching | Network efficiency | Client Components, SWR usage |
| **MEDIUM** | Re-render Optimization | UI responsiveness | Component optimization |
| **MEDIUM** | Rendering Performance | Browser work reduction | DOM manipulation, animations |
| **LOW-MEDIUM** | JavaScript Performance | Hot path optimization | Loops, calculations |

### 1. Eliminating Waterfalls (CRITICAL)

**Rule: Move await into branches where actually used**
```typescript
// ❌ Bad - Forces sequential execution
async function loadPortfolio() {
  const balances = await fetchBalances()
  const prices = await fetchPrices()
  if (balances.length > 0) {
    return formatPortfolio(balances, prices)
  }
}

// ✅ Good - Parallel execution
async function loadPortfolio() {
  const [balances, prices] = await Promise.all([
    fetchBalances(),
    fetchPrices()
  ])
  if (balances.length > 0) {
    return formatPortfolio(balances, prices)
  }
}
```

**Rule: Start promises early in API routes**
```typescript
// ❌ Bad - Sequential
export async function GET(request: Request) {
  const user = await getUser()
  const portfolio = await getPortfolio(user.id)
  return Response.json(portfolio)
}

// ✅ Good - Parallel
export async function GET(request: Request) {
  const userPromise = getUser()
  const user = await userPromise
  const portfolioPromise = getPortfolio(user.id)
  return Response.json(await portfolioPromise)
}
```

**Rule: Use Suspense boundaries to stream content**
```tsx
// ✅ Good - Stream heavy components
import { Suspense } from 'react'

export default function PortfolioPage() {
  return (
    <>
      <PortfolioHeader />
      <Suspense fallback={<BalancesSkeleton />}>
        <BalancesPanel />
      </Suspense>
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionHistory />
      </Suspense>
    </>
  )
}
```

### 2. Bundle Size Optimization (CRITICAL)

**Rule: Import directly, avoid barrel files**
```typescript
// ❌ Bad - Imports entire module
import { Box } from '@chakra-ui/react'

// ✅ Good - Direct import (if available)
import { Box } from '@chakra-ui/react/box'

// For Chakra UI specifically, tree-shaking works, but verify bundle impact
```

**Rule: Use next/dynamic for heavy components**
```typescript
// ✅ Good - Code split heavy swap components
import dynamic from 'next/dynamic'

const SwapQuote = dynamic(() => import('@/components/swap/SwapQuote'), {
  loading: () => <Skeleton height="200px" />,
  ssr: false // If component uses browser-only APIs
})
```

**Rule: Load analytics after hydration**
```typescript
// ✅ Good - Defer non-critical scripts
'use client'
import { useEffect } from 'react'

export function Analytics() {
  useEffect(() => {
    // Load after hydration
    import('@/lib/analytics').then(({ init }) => init())
  }, [])
  return null
}
```

**Rule: Preload on hover/focus**
```tsx
// ✅ Good - Preload swap UI on hover
'use client'
import { useRouter } from 'next/navigation'

export function SwapButton() {
  const router = useRouter()

  return (
    <button
      onMouseEnter={() => router.prefetch('/swap')}
      onFocus={() => router.prefetch('/swap')}
    >
      Swap
    </button>
  )
}
```

### 3. Server-Side Performance (HIGH)

**Rule: Use React.cache() for per-request deduplication**
```typescript
// ✅ Good - Deduplicate fetches within single request
import { cache } from 'react'

export const getPortfolio = cache(async (deviceId: string) => {
  return await pioneerService.getPortfolio(deviceId)
})

// Multiple components can call this, only executes once per request
```

**Rule: Minimize data passed to client components**
```tsx
// ❌ Bad - Sending entire portfolio to client
'use client'
export function BalanceDisplay({ portfolio }: { portfolio: Portfolio }) {
  return <Text>{portfolio.totalUsdValue}</Text>
}

// ✅ Good - Only send what's needed
'use client'
export function BalanceDisplay({ balance }: { balance: string }) {
  return <Text>{balance}</Text>
}

// Server Component does the filtering
export default function Portfolio() {
  const portfolio = await getPortfolio()
  return <BalanceDisplay balance={portfolio.totalUsdValue} />
}
```

**Rule: Restructure components to parallelize fetches**
```tsx
// ❌ Bad - Serial fetches in hierarchy
async function Parent() {
  const user = await getUser()
  return <Child userId={user.id} />
}

async function Child({ userId }: { userId: string }) {
  const portfolio = await getPortfolio(userId)
  return <div>{portfolio.balance}</div>
}

// ✅ Good - Parallel fetches
async function Parent() {
  const userPromise = getUser()
  const portfolioPromise = getPortfolio((await userPromise).id)

  return (
    <>
      <UserInfo userPromise={userPromise} />
      <Portfolio portfolioPromise={portfolioPromise} />
    </>
  )
}
```

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

**Rule: Use SWR for automatic request deduplication**
```typescript
// ✅ Good - SWR deduplicates across components
'use client'
import useSWR from 'swr'

export function usePortfolio(deviceId: string) {
  return useSWR(`/api/portfolio/${deviceId}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 2000
  })
}

// Multiple components using this hook = single request
```

### 5. Re-render Optimization (MEDIUM)

**Rule: Don't subscribe to state only used in callbacks**
```typescript
// ❌ Bad - Unnecessary re-renders
const [count, setCount] = useState(0)
const handleClick = () => console.log(count)

// ✅ Good - Use ref for callback-only values
const countRef = useRef(0)
const handleClick = () => console.log(countRef.current)
```

**Rule: Extract expensive work into memoized components**
```tsx
// ❌ Bad - Re-renders entire transaction list
function TransactionHistory({ transactions }: Props) {
  return (
    <>
      {transactions.map(tx => (
        <TransactionRow key={tx.id} transaction={tx} />
      ))}
    </>
  )
}

// ✅ Good - Memoize individual rows
const TransactionRow = memo(function TransactionRow({ transaction }: Props) {
  return <Box>{transaction.hash}</Box>
})
```

**Rule: Subscribe to derived booleans, not raw values**
```typescript
// ❌ Bad - Re-renders on every balance change
const balance = usePortfolioStore(state => state.balance)
const hasBalance = balance > 0

// ✅ Good - Only re-renders when boolean changes
const hasBalance = usePortfolioStore(state => state.balance > 0)
```

**Rule: Use functional setState for stable callbacks**
```typescript
// ❌ Bad - Callback recreated on every count change
const [count, setCount] = useState(0)
const increment = () => setCount(count + 1)

// ✅ Good - Stable callback
const [count, setCount] = useState(0)
const increment = () => setCount(c => c + 1)
```

**Rule: Use startTransition for non-urgent updates**
```typescript
// ✅ Good - Keep UI responsive during heavy updates
import { startTransition } from 'react'

function SearchTransactions() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  const handleSearch = (value: string) => {
    setQuery(value) // Urgent: update input
    startTransition(() => {
      setResults(filterTransactions(value)) // Non-urgent: filter
    })
  }
}
```

### 6. Rendering Performance (MEDIUM)

**Rule: Use content-visibility for long lists**
```css
/* ✅ Good - Optimize long transaction lists */
.transaction-row {
  content-visibility: auto;
  contain-intrinsic-size: 80px;
}
```

**Rule: Hoist static JSX outside components**
```tsx
// ❌ Bad - Icon recreated every render
function SendButton() {
  return (
    <Button>
      <Icon as={FiSend} />
      Send
    </Button>
  )
}

// ✅ Good - Icon created once
const SendIcon = <Icon as={FiSend} />

function SendButton() {
  return (
    <Button>
      {SendIcon}
      Send
    </Button>
  )
}
```

**Rule: Use ternary, not && for conditionals**
```tsx
// ❌ Bad - Renders 0 if count is 0
<div>{count && <Badge>{count}</Badge>}</div>

// ✅ Good - Renders null when falsy
<div>{count > 0 ? <Badge>{count}</Badge> : null}</div>
```

### 7. JavaScript Performance (LOW-MEDIUM)

**Rule: Use Set/Map for O(1) lookups**
```typescript
// ❌ Bad - O(n) lookup
const assetIds = ['btc', 'eth', 'atom']
const hasBTC = assetIds.includes('btc')

// ✅ Good - O(1) lookup
const assetSet = new Set(['btc', 'eth', 'atom'])
const hasBTC = assetSet.has('btc')
```

**Rule: Cache expensive calculations**
```typescript
// ✅ Good - Cache portfolio calculations
const portfolioCache = new Map()

function calculatePortfolioValue(assets: Asset[]): number {
  const key = assets.map(a => a.id).join(',')
  if (portfolioCache.has(key)) {
    return portfolioCache.get(key)
  }

  const value = assets.reduce((sum, asset) => sum + asset.usdValue, 0)
  portfolioCache.set(key, value)
  return value
}
```

## Web Interface Guidelines

### Accessibility (CRITICAL)

**Rule: Use semantic HTML**
```tsx
// ❌ Bad
<div onClick={handleClick}>Click me</div>

// ✅ Good
<button onClick={handleClick}>Click me</button>
```

**Rule: Include aria-labels for icon buttons**
```tsx
// ❌ Bad
<IconButton icon={<FiX />} onClick={onClose} />

// ✅ Good
<IconButton
  icon={<FiX />}
  onClick={onClose}
  aria-label="Close modal"
/>
```

**Rule: Ensure keyboard navigation**
```tsx
// ✅ Good - Keyboard accessible
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick()
    }
  }}
>
  Action
</div>
```

### Forms & Validation

**Rule: Use autocomplete attributes**
```tsx
// ✅ Good
<Input
  type="text"
  name="address"
  autoComplete="street-address"
/>
```

**Rule: Validate on blur, not on change**
```tsx
// ✅ Good - Better UX
<Input
  value={address}
  onChange={(e) => setAddress(e.target.value)}
  onBlur={validateAddress}
  isInvalid={!isValid && touched}
/>
```

### Performance

**Rule: Use dimensions for images**
```tsx
// ❌ Bad
<img src="/logo.png" alt="Logo" />

// ✅ Good - Prevents layout shift
<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={50}
/>
```

**Rule: Lazy load images**
```tsx
// ✅ Good
<Image
  src={assetIcon}
  alt={assetName}
  loading="lazy"
  width={32}
  height={32}
/>
```

### Dark Mode & Theming

**Rule: Use CSS variables for theme values**
```tsx
// ✅ Good - Respects system preference
export const colors = {
  bg: 'var(--chakra-colors-bg)',
  text: 'var(--chakra-colors-text)',
}
```

**Rule: Respect prefers-color-scheme**
```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: #1a1a1a;
  }
}
```

## Critical Development Rules

### NEVER MOCK ANYTHING
- **NEVER** give fake data or create fake endpoints
- **NEVER** return stub implementations with fake values
- **NEVER** create mock portfolios with $1234.56 USD or similar fake data
- If something isn't implemented, return proper error status or loading state

### Pioneer SDK Integration
- ALL blockchain operations go through Pioneer SDK
- Use services in `src/services/` for API calls
- Check `src/services/pioneer-swap-service.ts` for swap patterns
- NEVER bypass Pioneer SDK for blockchain data

### Component Guidelines
- Server Components by default
- Add `'use client'` only when needed:
  - Using React hooks (useState, useEffect, etc.)
  - Browser APIs (window, localStorage, etc.)
  - Event handlers directly on elements
  - Third-party client libraries
- Extract theme utilities to `*.theme.ts` files
- Extract pure utility functions to `src/utils/`

### State Management
- Prefer React Context for global state
- Use local state when possible
- Server state via SWR or React Query
- NEVER duplicate server state in global state

### Styling
- Use Chakra UI components
- Theme values from Chakra theme
- Responsive props: `{ base: 'sm', md: 'md' }`
- Extract complex styles to theme files

### File Organization
```
component/
├── ComponentName.tsx       # Main component
├── ComponentName.theme.ts  # Theme utilities (if complex)
└── ComponentName.test.tsx  # Tests
```

## Testing

**Rule: Test compiled output for TypeScript modules**
```javascript
// ✅ Good - Test actual build output
// __tests__/test-module.js
const module = require('../lib/index')  // Compiled JS

// NOT ../src/index.ts
```

**Rule: Build before test**
```json
{
  "scripts": {
    "test": "npm run build && node __tests__/test-module.js"
  }
}
```

## Common Patterns

### Loading States
```tsx
// ✅ Good pattern
'use client'
export function Portfolio() {
  const { data, error, isLoading } = usePortfolio()

  if (isLoading) return <Skeleton />
  if (error) return <ErrorDisplay error={error} />
  if (!data) return null

  return <PortfolioDisplay data={data} />
}
```

### Error Boundaries
```tsx
// ✅ Good - Wrap risky components
<ErrorBoundary fallback={<ErrorDisplay />}>
  <SwapQuote />
</ErrorBoundary>
```

### Transaction History Pattern
```tsx
// ✅ Good - Memoize rows, virtualize if >100 items
import { memo } from 'react'

const TransactionRow = memo(function TransactionRow({ tx }: Props) {
  return <Box>{tx.hash}</Box>
})

export function TransactionHistory({ transactions }: Props) {
  return (
    <VStack>
      {transactions.map(tx => (
        <TransactionRow key={tx.id} transaction={tx} />
      ))}
    </VStack>
  )
}
```

## Build & Development

### Commands
```bash
# Development
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run start        # Start production server

# Testing
npm run lint         # ESLint
npm run type-check   # TypeScript check
npm test             # Run tests
```

### Environment Variables
- **NEVER** create or modify `.env` files without asking
- **NEVER** commit `.env` files
- Check `.env.example` for required variables
- All env vars should have `NEXT_PUBLIC_` prefix if used in client

### Performance Monitoring
- Use Next.js built-in analytics
- Monitor Core Web Vitals
- Check bundle size: `npm run build` shows bundle analysis
- Profile with React DevTools

## Code Review Checklist

Before marking work complete:

- [ ] No `'use client'` unless necessary
- [ ] Server/Client Components used appropriately
- [ ] No barrel imports from large libraries
- [ ] Heavy components code-split with `next/dynamic`
- [ ] Images have width/height attributes
- [ ] Accessibility: semantic HTML, aria-labels, keyboard nav
- [ ] Loading states for async operations
- [ ] Error boundaries around risky components
- [ ] No fake data or mock implementations
- [ ] TypeScript types defined (no `any`)
- [ ] Responsive design tested
- [ ] Dark mode works correctly

## Resources

**Next.js Documentation:**
- App Router: https://nextjs.org/docs/app
- Server Components: https://nextjs.org/docs/app/building-your-application/rendering/server-components
- Performance: https://nextjs.org/docs/app/building-your-application/optimizing

**Chakra UI:**
- Components: https://chakra-ui.com/docs/components
- Theming: https://chakra-ui.com/docs/styled-system/theme

**React Performance:**
- Vercel Best Practices: Internal reference (this document)
- React DevTools Profiler: https://react.dev/learn/react-developer-tools

## When in Doubt

1. **Read the code** - Check existing patterns before creating new ones
2. **Ask the user** - Clarify requirements rather than assume
3. **Fail fast** - Return errors instead of mocking data
4. **Keep it simple** - Avoid premature optimization
5. **Follow the framework** - Use Next.js and React patterns correctly
