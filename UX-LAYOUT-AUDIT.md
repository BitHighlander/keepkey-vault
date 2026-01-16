# UX Layout Architecture Audit

## Problem Summary
The Send component and ReviewTransaction dialog are stretching to full viewport height instead of fitting their content.

## Root Causes

### 1. Send Component Force Height (CRITICAL)
**File**: `src/components/send/Send.tsx:2747`
```tsx
<Box
  width="100%"
  maxWidth="600px"
  mx="auto"
  height="100vh"  ← ❌ FORCES FULL HEIGHT
  position="relative"
  ...
>
```

**Issue**: The main Send container has `height="100vh"` which forces it to take full viewport height regardless of content.

**Fix**: Change to `minHeight` or remove entirely to let content dictate height.

---

### 2. Page Container Fixed Height
**File**: `src/app/asset/[caip]/page.tsx:350`
```tsx
<Box
  minHeight={{ base: 'calc(100vh - 32px)', md: 'calc(100vh - 48px)', lg: 'calc(100vh - 64px)' }}
  ...
>
  <Box
    overflowY="auto"  ← ❌ NO HEIGHT SET
    ...
  >
```

**Issue**: Outer container uses `minHeight` (we fixed this from `height`) but the inner scrolling Box doesn't have a height, so it can't properly contain content that wants to shrink.

**Fix**: Inner Box needs either:
- `height="100%"` to fill the min-height container for scrolling
- OR remove outer `minHeight` and let everything fit content

---

### 3. Header Duplication (Architecture Issue)
**Current State**: Each view (Dashboard, Send, Asset, Swap) has its own header implementation.

**Dashboard Header** (`src/components/dashboard/Dashboard.tsx:634-691`):
```tsx
<Box
  borderBottom="1px"
  borderColor={theme.border}
  p={4}
  bg={theme.cardBg}
  position="relative"
>
  <HStack justify="space-between">
    <HStack>
      <Image src="/images/kk-icon-gold.png" />
      <Text>KeepKey Vault</Text>
    </HStack>
    <HStack>
      <IconButton icon={<FaSyncAlt />} />
      <Button>Settings</Button>
    </HStack>
  </HStack>
</Box>
```

**Send Header** (`src/components/send/Send.tsx:2938-2990`):
```tsx
<Box
  borderBottom="1px"
  bg={theme.cardBg}
  position="sticky"
  top={0}
  zIndex={10}
>
  <Flex justify="space-between">
    <Button onClick={currentStep === 1 ? onBackClick : prevStep}>
      Back
    </Button>
    <Text>Send {assetContext?.name}</Text>
    <Box w="60px"></Box>
  </Flex>
  {/* Step Progress Indicator */}
  {/* Step Title */}
</Box>
```

**Issue**: Headers are embedded in each component, making it hard to maintain consistent UX and causing layout issues.

---

## Recommended Architecture

### Solution 1: Create Global PageHeader Component

**New File**: `src/components/layout/PageHeader.tsx`
```tsx
interface PageHeaderProps {
  title: string
  leftAction?: {
    label: string
    onClick: () => void
  }
  rightActions?: ReactNode
  showProgress?: {
    currentStep: number
    totalSteps: number
    stepTitle: string
  }
}

export function PageHeader({ title, leftAction, rightActions, showProgress }: PageHeaderProps) {
  return (
    <Box
      borderBottom="1px"
      borderColor={theme.border}
      bg={theme.cardBg}
      position="sticky"
      top={0}
      zIndex={10}
    >
      <Flex justify="space-between" align="center" p={4} pb={showProgress ? 2 : 4}>
        {leftAction ? (
          <Button size="sm" variant="ghost" onClick={leftAction.onClick}>
            {leftAction.label}
          </Button>
        ) : (
          <Box w="60px" />
        )}

        <Text fontWeight="bold" color={assetColor}>
          {title}
        </Text>

        {rightActions || <Box w="60px" />}
      </Flex>

      {showProgress && (
        <>
          <Flex gap={2} px={4} pb={4}>
            {Array.from({ length: showProgress.totalSteps }).map((_, i) => (
              <Box
                key={i}
                flex={1}
                height="3px"
                borderRadius="full"
                bg={i < showProgress.currentStep ? assetColor : theme.borderAlt}
              />
            ))}
          </Flex>

          <Box px={4} pb={3}>
            <Text color="gray.400" fontSize="xs">
              STEP {showProgress.currentStep} OF {showProgress.totalSteps}
            </Text>
            <Text color="white" fontSize="lg" fontWeight="bold">
              {showProgress.stepTitle}
            </Text>
          </Box>
        </>
      )}
    </Box>
  )
}
```

### Solution 2: Fix Send Component Layout

**File**: `src/components/send/Send.tsx`

**Remove**:
- Lines 2938-2990 (entire header section)
- Line 2747 `height="100vh"`

**Add** at top of return:
```tsx
return (
  <>
    <PageHeader
      title={`Send ${assetContext?.name || 'Asset'}`}
      leftAction={{
        label: "Back",
        onClick: currentStep === 1 ? onBackClick : prevStep
      }}
      showProgress={{
        currentStep,
        totalSteps: 3,
        stepTitle: currentStep === 1 ? 'Enter Recipient' :
                   currentStep === 2 ? 'Enter Amount' :
                   'Select Fee & Send'
      }}
    />

    <Box
      width="100%"
      maxWidth="600px"
      mx="auto"
      // NO height property - let content dictate
      position="relative"
      pb={8}
      ...
    >
```

### Solution 3: Fix Page Container

**File**: `src/app/asset/[caip]/page.tsx`

**Option A** - Let content fit (Recommended for Send/Receive/Swap):
```tsx
<Box
  // Remove minHeight entirely
  overflow="hidden"
  position="relative"
  maxW={{ base: '100%', md: '768px', lg: '1200px' }}
  width="100%"
  mx="auto"
  bg="rgba(0, 0, 0, 0.6)"
  backdropFilter="blur(10px)"
  borderRadius="2xl"
  borderWidth="1px"
  borderColor={`${assetColor}40`}
  boxShadow={`0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${assetColor}20`}
>
  <Box
    maxHeight="90vh"  // Prevent overflow on small screens
    overflowY="auto"
    ...
  >
```

**Option B** - Keep viewport height for Dashboard only:
```tsx
// In Asset page, conditionally apply height
<Box
  minHeight={currentView === 'asset' ? {
    base: 'calc(100vh - 32px)',
    md: 'calc(100vh - 48px)',
    lg: 'calc(100vh - 64px)'
  } : undefined}
  ...
>
  <Box
    height={currentView === 'asset' ? '100%' : undefined}
    overflowY="auto"
    ...
  >
```

---

## Implementation Priority

1. **HIGH**: Remove `height="100vh"` from Send component (src/components/send/Send.tsx:2747)
2. **HIGH**: Update page container to not force height for Send/Swap views (src/app/asset/[caip]/page.tsx:350)
3. **MEDIUM**: Create PageHeader component
4. **MEDIUM**: Refactor Send to use PageHeader
5. **LOW**: Apply PageHeader to Receive and Swap components
6. **LOW**: Consider applying to Asset and Dashboard for consistency

---

## Testing Checklist

After fixes:
- [ ] Send component fits content (no empty space)
- [ ] ReviewTransaction dialog fits content
- [ ] Back button works on all steps
- [ ] Progress indicator shows correctly
- [ ] Dashboard still uses full height (if desired)
- [ ] Scrolling works when content exceeds viewport
- [ ] Mobile responsive behavior maintained
