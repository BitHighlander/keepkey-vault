/**
 * ActivityTracker — floating bubble (bottom-left) showing recent transaction activity.
 *
 * Always visible. Every tx for the wallet (api_log + swap_history, no cap),
 * kept live by the backend's 'activity-changed' push.
 * Captures: broadcasts, swaps, API signs, messages.
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { Box, Text } from "@chakra-ui/react"
import { rpcRequest, onRpcMessage } from "../lib/rpc"
import { Z } from "../lib/z-index"
import { ActivityPanel } from "./ActivityPanel"
import { SwapDialog } from "./SwapDialog"
import { useRecentActivity } from "../hooks/useRecentActivity"
import type { PendingSwap, SwapStatusUpdate, DeviceStateInfo } from "../../shared/types"

const TRACKER_CSS = `
  @keyframes kkActivityPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(35,220,200,0.5); }
    50% { box-shadow: 0 0 0 8px rgba(35,220,200,0); }
  }
  @keyframes kkBounceUp {
    0% { transform: scale(1) translateY(0); }
    20% { transform: scale(1.35) translateY(-6px); }
    40% { transform: scale(1.15) translateY(-2px); }
    60% { transform: scale(1.25) translateY(-4px); }
    80% { transform: scale(1.05) translateY(-1px); }
    100% { transform: scale(1) translateY(0); }
  }
  @keyframes kkCountSlideUp {
    0% { opacity: 0; transform: translateY(8px) scale(0.8); }
    40% { opacity: 1; transform: translateY(-3px) scale(1.1); }
    70% { transform: translateY(1px) scale(1.0); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
`

export function ActivityTracker() {
  // Every activity row, kept live by the backend's 'activity-changed' push.
  const { activities, refresh: fetchActivities } = useRecentActivity()
  const [pendingSwaps, setPendingSwaps] = useState<PendingSwap[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [resumeSwap, setResumeSwap] = useState<PendingSwap | null>(null)
  const [hasNew, setHasNew] = useState(false)
  const [bouncing, setBouncing] = useState(false)
  const lastCountRef = useRef(0)
  const lastDeviceStateKeyRef = useRef<string>('')
  const bounceTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // Fetch pending swaps (for live swap tracking)
  const fetchSwaps = useCallback(() => {
    rpcRequest<PendingSwap[]>('getPendingSwaps', undefined, 5000)
      .then((result) => { if (result) setPendingSwaps(result) })
      .catch((err) => { console.warn('[ActivityTracker] fetch swaps failed:', err.message) })
  }, [])

  useEffect(() => { fetchSwaps() }, [fetchSwaps])

  // Device and seed changes can happen without remounting this component.
  // Clear first so the previous wallet's swaps are never displayed while the
  // scoped backend query is catching up (useRecentActivity does the same for rows).
  useEffect(() => {
    const unsub = onRpcMessage('device-state', (state: DeviceStateInfo) => {
      const stateKey = `${state.state}:${state.deviceId || ''}:${state.isHiddenWallet ? 'hidden' : 'standard'}`
      if (stateKey !== lastDeviceStateKeyRef.current) {
        lastDeviceStateKeyRef.current = stateKey
        setPendingSwaps([])
      }
      // Hidden wallets included: getPendingSwaps serves in-memory (never-persisted)
      // swaps, scoped to the hidden walletId.
      if (state.state === 'ready' && state.deviceId) fetchSwaps()
    })
    return unsub
  }, [fetchSwaps])

  // Swap lifecycle. The swap's activity row follows via 'activity-changed'.
  useEffect(() => {
    const unsub1 = onRpcMessage('swap-update', (_update: SwapStatusUpdate) => {
      fetchSwaps()
    })
    const unsub2 = onRpcMessage('swap-complete', (swap: PendingSwap) => {
      fetchSwaps()
      if (swap.status === 'completed' || swap.status === 'refunded') {
        window.dispatchEvent(new CustomEvent('keepkey-swap-completed', {
          detail: { ...swap, swap }
        }))
      }
    })
    return () => { unsub1(); unsub2() }
  }, [fetchSwaps])

  // Listen for swap-executed DOM event from SwapDialog
  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>
    const handler = () => {
      fetchSwaps()
      t1 = setTimeout(fetchSwaps, 1000)
    }
    window.addEventListener('keepkey-swap-executed', handler)
    return () => {
      window.removeEventListener('keepkey-swap-executed', handler)
      clearTimeout(t1)
    }
  }, [fetchSwaps])

  // Detect new items — trigger bounce animation
  const activeSwaps = pendingSwaps.filter(s =>
    s.status !== 'completed' && s.status !== 'failed' && s.status !== 'refunded'
  )
  const activeSwapCount = activeSwaps.length
  // Subtract active swaps already merged into activities (via swap_history→activity in db.ts)
  // to avoid double-counting them in the bubble total.
  const activityTxids = new Set(activities.filter(a => a.txid).map(a => a.txid))
  const overlappingSwapCount = activeSwaps.filter(s => s.txid && activityTxids.has(s.txid)).length
  const totalCount = activities.length + activeSwapCount - overlappingSwapCount
  useEffect(() => {
    if (totalCount > lastCountRef.current && lastCountRef.current > 0) {
      setHasNew(true)
      setBouncing(true)
      if (bounceTimeoutRef.current) clearTimeout(bounceTimeoutRef.current)
      bounceTimeoutRef.current = setTimeout(() => setBouncing(false), 700)
    }
    lastCountRef.current = totalCount
  }, [totalCount])

  useEffect(() => {
    if (!panelOpen || activities.length > 0 || pendingSwaps.length > 0) return
    fetchActivities()
    fetchSwaps()
    const interval = setInterval(() => {
      fetchActivities()
      fetchSwaps()
    }, 2500)
    return () => clearInterval(interval)
  }, [panelOpen, activities.length, pendingSwaps.length, fetchActivities, fetchSwaps])

  const handleOpen = () => {
    setPanelOpen(true)
    setHasNew(false)
    fetchActivities()
    fetchSwaps()
  }

  // Label
  const displayCount = activities.length + activeSwapCount - overlappingSwapCount
  let label: string
  if (displayCount === 0) {
    label = 'Activity'
  } else if (activeSwapCount > 0 && activities.length > 0) {
    label = `${displayCount} event${displayCount > 1 ? 's' : ''}`
  } else if (activeSwapCount > 0) {
    label = `${activeSwapCount} swap${activeSwapCount > 1 ? 's' : ''}`
  } else {
    label = `${activities.length} tx${activities.length > 1 ? 's' : ''}`
  }

  const bubbleAnimation = bouncing
    ? 'kkBounceUp 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)'
    : hasNew
      ? 'kkActivityPulse 2s ease-in-out infinite'
      : 'none'

  return (
    <>
      <style>{TRACKER_CSS}</style>

      {/* Floating bubble — always visible.
          transform-origin pins growth to the bottom-right corner so the
          bounce/hover scale doesn't push the pill past the viewport edge. */}
      <Box position="fixed" bottom="28px" right="28px" zIndex={Z.nav + 1}>
        <Box
          as="button"
          display="flex"
          alignItems="center"
          gap="2"
          bg={displayCount > 0 ? "rgba(35,220,200,0.15)" : "rgba(255,255,255,0.05)"}
          border="1px solid"
          borderColor={displayCount > 0 ? "rgba(35,220,200,0.4)" : "rgba(255,255,255,0.1)"}
          borderRadius="full"
          px="3"
          py="1.5"
          cursor="pointer"
          transformOrigin="bottom right"
          _hover={{ bg: displayCount > 0 ? "rgba(35,220,200,0.25)" : "rgba(255,255,255,0.1)", transform: "scale(1.05)" }}
          transition="all 0.2s"
          onClick={handleOpen}
          style={{ animation: bubbleAnimation, transformOrigin: "bottom right" }}
        >
          {activeSwapCount > 0 ? (
            <Box w="8px" h="8px" borderRadius="full" bg="#23DCC8" style={{ animation: 'kkActivityPulse 1.5s ease-in-out infinite' }} />
          ) : (
            <Text fontSize="xs" opacity={displayCount > 0 ? 1 : 0.5}>&#9889;</Text>
          )}
          <Text
            fontSize="xs"
            fontWeight="600"
            color={displayCount > 0 ? "#23DCC8" : "whiteAlpha.500"}
            style={bouncing ? {
              display: 'inline-block',
              animation: 'kkCountSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            } : {}}
          >
            {label}
          </Text>
        </Box>
      </Box>

      {/* Activity panel */}
      <ActivityPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        activities={activities}
        pendingSwaps={pendingSwaps}
        onRefresh={() => { fetchActivities(); fetchSwaps() }}
        onResumeSwap={(swap) => { setPanelOpen(false); setResumeSwap(swap) }}
        onOpenFullPage={() => window.dispatchEvent(new CustomEvent('keepkey-open-activity'))}
      />

      {/* Resume swap dialog — opened from activity panel swap click */}
      <SwapDialog
        open={!!resumeSwap}
        onClose={() => setResumeSwap(null)}
        resumeSwap={resumeSwap}
      />
    </>
  )
}
