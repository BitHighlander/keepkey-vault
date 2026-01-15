'use client';

import { useEffect, useState, useRef } from 'react';
import { SwapProgress } from './SwapProgress';
import { DialogRoot, DialogContent, DialogBody } from '@/components/ui/dialog';

/**
 * GlobalSwapProgress - Global swap progress dialog
 *
 * ARCHITECTURE:
 * - Listens ONLY to 'swap:reopen' events (user explicitly opens from bubble)
 * - Does NOT auto-open on 'swap:broadcast' (prevents unwanted opens during navigation)
 * - PendingSwapsPopup handles all auto-open logic
 * - This component is purely for manual reopening of swap details
 */
export function GlobalSwapProgress() {
  const [showSwapProgress, setShowSwapProgress] = useState(false);
  const [swapProgressData, setSwapProgressData] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Track shown swaps to prevent duplicate opens
  const shownSwapsRef = useRef<Set<string>>(new Set());
  const renderCountRef = useRef(0);

  // Log every render
  renderCountRef.current++;
  console.log(`🔄 [GlobalSwapProgress] RENDER #${renderCountRef.current}`, {
    showSwapProgress,
    hasData: !!swapProgressData,
    dataKeys: swapProgressData ? Object.keys(swapProgressData) : 'none',
    isMounted
  });

  useEffect(() => {
    console.log('🔄 [GlobalSwapProgress] Component mounted');
    setIsMounted(true);
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (!isMounted) return;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎧 [GlobalSwapProgress] Setting up event listener');
    console.log('🎧 Current state:', { showSwapProgress, hasData: !!swapProgressData });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ONLY listen to swap:reopen (user action from PendingSwapsPopup)
    // Do NOT listen to swap:broadcast (causes unwanted opens during navigation)
    const handleSwapReopen = (event: CustomEvent) => {
      const txHash = event.detail?.txHash;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔄 [GlobalSwapProgress] SWAP:REOPEN EVENT RECEIVED');
      console.log('🔄 TxHash:', txHash);
      console.log('🔄 Event detail:', event.detail);
      console.log('🔄 Call stack:', new Error().stack);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      setSwapProgressData(event.detail);
      setShowSwapProgress(true);

      // Track that we've shown this swap
      if (txHash) {
        shownSwapsRef.current.add(txHash);
      }
    };

    window.addEventListener('swap:reopen', handleSwapReopen as EventListener);

    return () => {
      console.log('🧹 [GlobalSwapProgress] Cleaning up event listener');
      window.removeEventListener('swap:reopen', handleSwapReopen as EventListener);
    };
  }, [isMounted]);

  // Don't render anything until mounted on client (prevents hydration mismatch)
  if (!isMounted || !showSwapProgress || !swapProgressData) {
    return null;
  }

  return (
    <DialogRoot
      open={showSwapProgress}
      onOpenChange={(e) => {
        if (!e.open) {
          setShowSwapProgress(false);
        }
      }}
      size="xl"
    >
      <DialogContent
        bg="#000000"
        borderRadius="2xl"
        borderWidth="2px"
        borderColor="#1A1D23"
        maxW="900px"
        p={0}
      >
        <DialogBody p={0}>
          <SwapProgress
            txid={swapProgressData.txHash}
            fromAsset={swapProgressData.fromAsset}
            toAsset={swapProgressData.toAsset}
            inputAmount={swapProgressData.inputAmount}
            outputAmount={swapProgressData.outputAmount}
            integration={swapProgressData.integration || 'thorchain'}
            memo={swapProgressData.memo}
            onComplete={() => {
              setShowSwapProgress(false);
            }}
            onClose={() => {
              setShowSwapProgress(false);
            }}
          />
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
