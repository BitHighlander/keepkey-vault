'use client';

import { useEffect, useState } from 'react';
import { SwapProgress } from './SwapProgress';
import { DialogRoot, DialogContent, DialogBody } from '@/components/ui/dialog';

/**
 * GlobalSwapProgress - A global dialog that listens to swap events
 * and displays the SwapProgress modal.
 *
 * This component is separate from the Provider to avoid causing
 * Provider re-renders and dashboard refreshes when the dialog opens.
 *
 * It should be rendered at the layout level, outside the Provider.
 */
export function GlobalSwapProgress() {
  const [showSwapProgress, setShowSwapProgress] = useState(false);
  const [swapProgressData, setSwapProgressData] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Only render on client after hydration to avoid SSR hydration mismatches
  useEffect(() => {
    setIsMounted(true);
    console.log('🔄 [GlobalSwapProgress] Component mounted on client');
  }, []);

  // Log component render (only after mounted)
  if (isMounted) {
    console.log('🔄 [GlobalSwapProgress] Component render:', {
      showSwapProgress,
      hasData: !!swapProgressData
    });
  }

  // Set up event listeners only after component is mounted on client
  useEffect(() => {
    if (!isMounted) return;

    console.log('🎧 [GlobalSwapProgress] Setting up swap event listeners');

    const handleSwapBroadcast = (event: CustomEvent) => {
      console.log('🎯 [GlobalSwapProgress] Received swap:broadcast:', event.detail);
      console.log('🎯 [GlobalSwapProgress] Current state before update:', { showSwapProgress, swapProgressData });
      setSwapProgressData(event.detail);
      setShowSwapProgress(true);
      console.log('🎯 [GlobalSwapProgress] State setters called - dialog should open');
    };

    const handleSwapReopen = (event: CustomEvent) => {
      console.log('🔄 [GlobalSwapProgress] Received swap:reopen:', event.detail);
      console.log('🔄 [GlobalSwapProgress] Current state before update:', { showSwapProgress, swapProgressData });
      setSwapProgressData(event.detail);
      setShowSwapProgress(true);
      console.log('🔄 [GlobalSwapProgress] State setters called - dialog should open');
    };

    console.log('🎧 [GlobalSwapProgress] Attaching event listeners to window');
    window.addEventListener('swap:broadcast', handleSwapBroadcast as EventListener);
    window.addEventListener('swap:reopen', handleSwapReopen as EventListener);
    console.log('✅ [GlobalSwapProgress] Event listeners attached');

    return () => {
      console.log('🧹 [GlobalSwapProgress] Cleaning up swap event listeners');
      window.removeEventListener('swap:broadcast', handleSwapBroadcast as EventListener);
      window.removeEventListener('swap:reopen', handleSwapReopen as EventListener);
    };
  }, [isMounted]); // Only set up after isMounted becomes true

  // Don't render anything until mounted on client (prevents hydration mismatch)
  if (!isMounted) {
    return null;
  }

  console.log('🔍 [GlobalSwapProgress] Render check:', {
    showSwapProgress,
    hasSwapProgressData: !!swapProgressData,
    willRender: showSwapProgress && swapProgressData
  });

  if (!showSwapProgress || !swapProgressData) {
    console.log('⏭️ [GlobalSwapProgress] Not rendering - condition false');
    return null;
  }

  console.log('🎯 [GlobalSwapProgress] RENDERING SwapProgress dialog now!');

  return (
    <DialogRoot
      open={showSwapProgress}
      onOpenChange={(e) => {
        if (!e.open) {
          console.log('ℹ️ [GlobalSwapProgress] Dialog closed via onOpenChange');
          setShowSwapProgress(false);
          setSwapProgressData(null);
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
              console.log('✅ [GlobalSwapProgress] Swap completed - closing dialog');
              setShowSwapProgress(false);
              setSwapProgressData(null);
            }}
            onClose={() => {
              console.log('ℹ️ [GlobalSwapProgress] User closed dialog');
              setShowSwapProgress(false);
              setSwapProgressData(null);
            }}
          />
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
