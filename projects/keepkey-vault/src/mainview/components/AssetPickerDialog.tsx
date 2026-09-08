/**
 * Both sides require an explicit network choice before showing assets.
 * Network → Asset. Selecting an asset returns to the swap form. Source assets are scoped to wallet holdings.
 */
import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, type CSSProperties } from "react"
import { Box, Flex, Text, Input, Spinner } from "@chakra-ui/react"
import { useTranslation } from "react-i18next"
import { AssetIcon } from "./AssetIcon"
import type { SwapAsset, ChainBalance, CustomToken } from "../../shared/types"
import {
  buildAssetEntries,
  chainMetaForCaip2,
  networkDisplayName,
  synthesizeSwapAsset,
  compareForPicker,
  parseCaip,
  assessWithFirmware,
  isGasAsset,
  ellipsizeCaip,
  type AssetEntry,
} from "../../shared/swap-discovery"
import { rpcRequest } from "../lib/rpc"
import { useDeviceState } from "../hooks/useDeviceState"
import { CHAINS } from "../../shared/chains"
import { Z } from "../lib/z-index"
import { useFiat } from "../lib/fiat-context"
import { SWAP_ACCENT, SwapNetworkIcon, SwapNetworkBadge, SwapPickerProgress } from "./SwapSelectionGuide"
// ── constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

// ── icons ──────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)
const BackIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
)
const ArrowRight = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7"/>
  </svg>
)
const AlertIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)
const BellIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
)

// ── chain helpers ───────────────────────────────────────────────────────────

function chainColorForCaip2(caip2: string): string {
  const meta = chainMetaForCaip2(caip2)
  if (!meta) return "#555555"
  return CHAINS.find(c => c.id === meta.vaultChainId)?.color ?? "#555555"
}

function chainFamilyLabel(family: string): string {
  const map: Record<string, string> = {
    evm: "EVM", utxo: "UTXO", cosmos: "Cosmos",
    solana: "SOL", xrp: "XRP", tron: "TRX",
    ton: "TON", "zcash-shielded": "ZEC",
  }
  return map[family] ?? family.toUpperCase()
}

// ── selectability ───────────────────────────────────────────────────────────

function isRowSelectable(entry: AssetEntry): boolean {
  const s = entry.availability.status
  if (s !== "swappable" && s !== "unknown") return false
  return chainMetaForCaip2(entry.chainId) !== null
}

// ── provider dots — keys match SwapProvider type ────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  thorchain:  "#23DCC8",
  mayachain:  "#3B82F6",
  relay:      "#9F8CE0",
  zeroex:     "#5C6BC0",
  chainflip:  "#E84142",
  shapeshift: "#00C3FF",
}

function ProviderDots({ providers }: { providers: string[] }) {
  if (!providers.length) return null
  return (
    <Flex gap="1" title={providers.join(", ")} align="center">
      {providers.slice(0, 4).map(p => (
        <Box key={p} w="6px" h="6px" borderRadius="full" bg={PROVIDER_COLORS[p] ?? "#888"} />
      ))}
      {providers.length > 4 && <Box w="6px" h="6px" borderRadius="full" bg="rgba(255,255,255,0.2)" />}
    </Flex>
  )
}

// ── gas / token classifier badge ────────────────────────────────────────────

/** Small pill marking an asset as the chain's GAS (native) asset or a TOKEN.
 *  Gas assets get a gold pill so they read as "this pays for gas / is the
 *  chain's own coin" and never get confused with a same-symbol token. */
function GasTokenBadge({ entry }: { entry: AssetEntry }) {
  const gas = isGasAsset(entry)
  return (
    <Box
      bg={gas ? "rgba(233,196,106,0.14)" : "rgba(255,255,255,0.06)"}
      color={gas ? "var(--gold)" : "kk.textMuted"}
      px="1.5" py="0.5" borderRadius="4px" fontSize="9px" fontWeight="700"
      letterSpacing="0.06em" flexShrink={0}>
      {gas ? "GAS" : "TOKEN"}
    </Box>
  )
}

// ── chain badge caip (network overlay on token icons) ──────────────────────

function chainBadgeCaip(entry: AssetEntry): string | undefined {
  if (entry.isNative) return undefined
  return chainMetaForCaip2(entry.chainId)?.nativeCaip
}

// ── shared search bar ───────────────────────────────────────────────────────

function SearchBar({ value, onChange, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean
}) {
  return (
    <Flex align="center" gap="2" mx="5" mb="3" px="3" py="2.5"
      bg="rgba(255,255,255,0.04)" border="1px solid" borderColor="rgba(255,255,255,0.08)"
      borderRadius="12px" flexShrink={0}
      _focusWithin={{ borderColor: "rgba(255,255,255,0.18)" }}>
      <Box color="kk.textMuted" flexShrink={0}><SearchIcon /></Box>
      <Input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} aria-label={placeholder}
        bg="transparent" border="none" color="kk.textPrimary" px="0" fontSize="12px"
        _focus={{ outline: "none", boxShadow: "none" }}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        autoFocus={autoFocus} />
      {value && (
        <Box as="button" aria-label="Clear search" color="kk.textMuted" cursor="pointer" onClick={() => onChange("")}
          _hover={{ color: "kk.textPrimary" }} border="none" bg="transparent" p="0" lineHeight="1">
          <CloseIcon />
        </Box>
      )}
    </Flex>
  )
}

// ── Held assets on the explicitly selected source network ───────────────

function FromPicker({ entries, chainCaip2, onSelect, fmtCompact, privateModeEnabled, balancesLoading }: {
  entries: AssetEntry[]; chainCaip2: string; onSelect: (e: AssetEntry) => void; fmtCompact: (v: number) => string; privateModeEnabled: boolean; balancesLoading: boolean
}) {
  const { t } = useTranslation("swap")
  const [search, setSearch] = useState("")

  // Held assets on this network, ranked by USD value
  const held = useMemo(
    () => entries.filter(e => e.balance && e.chainId === chainCaip2).sort((a, b) => (b.balance!.usd) - (a.balance!.usd)),
    [entries, chainCaip2]
  )

  const filtered = useMemo(() => {
    const list = held
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(e =>
      `${e.symbol} ${e.name} ${networkDisplayName(e.chainId)}`.toLowerCase().includes(q)
    )
  }, [held, search])

  const totalUsd = held.reduce((s, e) => s + (e.balance?.usd ?? 0), 0)

  return (
    <>
      {/* Summary strip */}
      <Flex align="baseline" justify="space-between" px="5" pb="3" flexShrink={0}>
        <Flex align="baseline" gap="2">
          <Text fontSize="10px" color="kk.textMuted" letterSpacing="0.08em" textTransform="uppercase">
            Available to swap
          </Text>
          <Text fontSize="26px" fontWeight="700" letterSpacing="-0.03em" color="kk.textPrimary" fontVariantNumeric="tabular-nums">
            {totalUsd > 0 ? (privateModeEnabled ? "••••••" : fmtCompact(totalUsd)) : "—"}
          </Text>
        </Flex>
        <Text fontSize="10px" color="kk.textMuted">
          {held.length} held assets
        </Text>
      </Flex>

      <SearchBar value={search} onChange={setSearch} placeholder={`Search your assets on ${networkDisplayName(chainCaip2)}…`} autoFocus />

      <Box flex="1" overflowY="auto" px="5" pb="4">
        {balancesLoading && held.length === 0 && !search ? (
          <Flex direction="column" align="center" py="16" gap="4">
            <Spinner size="md" color="kk.gold" />
            <Box textAlign="center">
              <Text fontSize="14px" fontWeight="500" color="kk.textSecondary" mb="1">
                {t("loadingAssets", "Loading assets...")}
              </Text>
              <Text fontSize="11px" color="kk.textMuted" lineHeight="1.6" maxW="320px">
                {t("loadingBalances", "Checking your KeepKey balances...")}
              </Text>
            </Box>
          </Flex>
        ) : filtered.length === 0 ? (
          <Flex direction="column" align="center" py="16" gap="4">
            <Box w="56px" h="56px" borderRadius="full" bg="rgba(255,255,255,0.04)"
              border="1px dashed rgba(255,255,255,0.10)" display="grid" placeItems="center" color="kk.textMuted">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>
              </svg>
            </Box>
            <Box textAlign="center">
              <Text fontSize="14px" fontWeight="500" color="kk.textSecondary" mb="1">
                {search ? "No held assets match" : t("emptyWalletTitle", "Your KeepKey is empty")}
              </Text>
              <Text fontSize="11px" color="kk.textMuted" lineHeight="1.6" maxW="320px">
                {search
                  ? "Try a different search term."
                  : t("emptyWalletSub", "Send some assets to your wallet first, then come back to swap.")}
              </Text>
            </Box>
          </Flex>
        ) : (
          <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))" gap="2.5">
            {filtered.map(e => <HeldTile key={e.caip} entry={e} onSelect={onSelect} fmtCompact={fmtCompact} privateModeEnabled={privateModeEnabled} />)}
          </Box>
        )}
      </Box>

      <Flex px="5" py="2.5" borderTop="1px solid" borderColor="kk.border"
        justify="space-between" align="center" flexShrink={0}>
        <Text fontSize="10px" color="kk.textMuted">Held assets · ranked by value</Text>
        <Text fontSize="10px" color="kk.textMuted">{filtered.length} of {held.length}</Text>
      </Flex>
    </>
  )
}

function HeldTile({ entry: e, onSelect, fmtCompact, privateModeEnabled }: {
  entry: AssetEntry; onSelect: (e: AssetEntry) => void; fmtCompact: (v: number) => string; privateModeEnabled: boolean
}) {
  const chainName = networkDisplayName(e.chainId)
  const selectable = isRowSelectable(e)
  const color = chainColorForCaip2(e.chainId)

  return (
    <Box
      as="button" textAlign="left" fontFamily="inherit"
      w="100%" aspectRatio="1"
      display="flex" flexDirection="column" justifyContent="space-between"
      bg={`linear-gradient(135deg, ${color}14 0%, rgba(255,255,255,0.02) 60%)`}
      border="1px solid" borderColor={`${color}35`}
      borderRadius="16px" p="3.5"
      position="relative" overflow="hidden"
      cursor={selectable ? "pointer" : "not-allowed"}
      opacity={selectable ? 1 : 0.5}
      color="kk.textPrimary"
      transition="all 0.18s"
      _hover={selectable ? {
        borderColor: `${color}70`,
        transform: "translateY(-2px)",
        boxShadow: `0 16px 30px -16px ${color}44`,
      } : {}}
      _before={{
        content: '""', position: "absolute", top: "-1px", right: "-1px",
        w: "70px", h: "70px",
        bg: `radial-gradient(circle at top right, ${color}28, transparent 70%)`,
        pointerEvents: "none",
      }}
      onClick={() => selectable && onSelect(e)}
    >
      {/* Chain color top stripe */}
      <Box position="absolute" top="0" left="0" right="0" h="2px"
        borderRadius="16px 16px 0 0" bg={color} opacity={0.75} />

      {/* Icon — 64px */}
      <AssetIcon caip={e.caip} iconUrl={e.iconUrl} chainCaip={chainBadgeCaip(e)} size={64} alt={e.symbol} />

      {/* Bottom info */}
      <Box mt="auto">
        <Text fontSize="18px" fontWeight="800" letterSpacing="-0.02em" lineHeight="1.2">{e.symbol}</Text>
        <Text fontSize="9px" color="kk.textMuted" letterSpacing="0.06em" textTransform="uppercase" mt="0.5">
          {chainName}
        </Text>
        <Text fontSize="14px" fontWeight="600" fontVariantNumeric="tabular-nums" mt="1.5" letterSpacing="-0.01em">
          {e.balance!.amount}
        </Text>
        <Text fontSize="11px" fontWeight="500" color="kk.textSecondary" fontVariantNumeric="tabular-nums">{privateModeEnabled ? "••••••" : fmtCompact(e.balance!.usd)}</Text>
        {/* Full CAIP */}
        <Text fontSize="8px" color="kk.textMuted" fontFamily="mono" mt="1.5" whiteSpace="nowrap" opacity={0.6}>
          {ellipsizeCaip(e.caip)}
        </Text>
      </Box>
    </Box>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TO picker — Step 1: network selection (square tiles)
// ══════════════════════════════════════════════════════════════════════════

interface ChainInfo {
  caip2: string
  name: string
  family: string
  color: string
  nativeCaip: string | undefined
  totalCount: number
  routableCount: number
  providers: string[]
  isAvailable: boolean
  /** A provider routes this chain, but the device's firmware can't sign/derive
   *  it — distinguishes "update firmware" from "no route at all". */
  firmwareGated: boolean
}

function buildChainInfos(entries: AssetEntry[], excludeCaip: string | undefined): ChainInfo[] {
  const chainIds = new Set(entries.map(e => e.chainId))
  return [...chainIds].map(caip2 => {
    const meta = chainMetaForCaip2(caip2)
    const chain = meta ? CHAINS.find(c => c.id === meta.vaultChainId) : null
    const assetsInChain = entries.filter(e => e.chainId === caip2 && e.caip !== excludeCaip)
    const routableInChain = assetsInChain.filter(e => isRowSelectable(e))
    const providers = new Set<string>()
    for (const e of routableInChain) for (const p of e.availability.providers) providers.add(p)
    return {
      caip2,
      name: networkDisplayName(caip2),
      family: chainFamilyLabel(meta?.chainFamily ?? ""),
      color: chain?.color ?? "#555555",
      nativeCaip: meta?.nativeCaip,
      totalCount: assetsInChain.length,
      routableCount: routableInChain.length,
      providers: [...providers],
      isAvailable: routableInChain.length > 0,
      firmwareGated: routableInChain.length === 0
        && assetsInChain.some(e => e.availability.status === "unsupported_firmware"),
    }
  }).sort((a, b) => b.routableCount - a.routableCount) // most assets first
}

function ChainStep({ chainInfos, search, onSearchChange, onPickChain, side, balancesLoading }: {
  chainInfos: ChainInfo[]
  search: string
  onSearchChange: (s: string) => void
  onPickChain: (caip2: string) => void
  side: "from" | "to"
  balancesLoading: boolean
}) {
  const q = search.trim().toLowerCase()
  const matches = chainInfos.filter(c => !q || `${c.name} ${c.family}`.toLowerCase().includes(q))
  const available = matches.filter(c => c.isAvailable)
  const unavailable = matches.filter(c => !c.isAvailable)
  return (
    <>
      <Text mx="5" mb="3" fontSize="12px" color="kk.textSecondary">
        {side === "from" ? "Where are you sending from? Choose a network to see your assets." : "Where do you want to receive? Choose a network, then an asset."}
      </Text>
      <SearchBar value={search} onChange={onSearchChange} placeholder="Search networks…" autoFocus />
      <Box flex="1" overflowY="auto" px="5" pb="4">
        {available.length > 0 && (
          <>
            <Flex align="center" gap="2" mb="3" mt="1">
              <Box w="6px" h="6px" bg={SWAP_ACCENT[side]} borderRadius="full" />
              <Text fontSize="10px" color="kk.textMuted" letterSpacing="0.1em" textTransform="uppercase">
                {side === "from" ? "Your networks" : "Destination networks"} · {available.length}
              </Text>
            </Flex>
            <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(145px, 1fr))" gap="2.5" mb="5">
              {available.map(c => <NetworkTile key={c.caip2} chain={c} onPick={onPickChain} side={side} />)}
            </Box>
          </>
        )}
        {unavailable.length > 0 && (
          <>
            <Text mb="3" fontSize="10px" color="kk.textMuted" letterSpacing="0.1em" textTransform="uppercase">Not currently available</Text>
            <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(145px, 1fr))" gap="2.5">
              {unavailable.map(c => <NetworkTile key={c.caip2} chain={c} onPick={onPickChain} side={side} unavail />)}
            </Box>
          </>
        )}
        {matches.length === 0 && (
          <Flex direction="column" align="center" py="12" gap="3" textAlign="center">
            {side === "from" && balancesLoading && !q ? <><Spinner color="var(--gold)" /><Text color="kk.textSecondary" fontSize="12px">Checking your network balances…</Text></> : <>
              <Text fontSize="14px" fontWeight="500" color="kk.textSecondary">{q ? "No matching networks" : "No funded networks yet"}</Text>
              <Text fontSize="11px" color="kk.textMuted" maxW="320px">
                {q ? "Search a network name, such as Ethereum or Base. You can search tokens after choosing a network." : "Your networks will appear here when your wallet has assets to swap."}
              </Text>
            </>}
          </Flex>
        )}
      </Box>
    </>
  )
}

function NetworkTile({ chain: c, onPick, side, unavail }: {
  chain: ChainInfo; onPick: (caip2: string) => void; side: "from" | "to"; unavail?: boolean
}) {
  return (
    <Box
      as="button" className="swap-network-tile" aria-label={`Select ${c.name} network`} aria-disabled={unavail} tabIndex={unavail ? -1 : 0} textAlign="left" fontFamily="inherit"
      w="100%" minH="164px"
      display="flex" flexDirection="column" justifyContent="space-between"
      bg={unavail ? "rgba(255,255,255,0.02)" : `radial-gradient(ellipse at 15% 0%, ${c.color}28, transparent 75%), rgba(255,255,255,0.02)`}
      border="1px solid" borderColor={unavail ? "rgba(255,255,255,0.06)" : `${c.color}28`}
      borderRadius="16px" p="3.5"
      position="relative" overflow="hidden"
      cursor={unavail ? "not-allowed" : "pointer"}
      opacity={unavail ? 0.42 : 1}
      color="kk.textPrimary"
      transition="all 0.15s"
      _hover={unavail ? {} : {
        bg: `${c.color}18`,
        borderColor: `${c.color}55`,
        transform: "translateY(-2px)",
        boxShadow: `0 12px 24px -12px ${c.color}40`,
      }}
      onClick={() => !unavail && onPick(c.caip2)}
    >
      {/* Chain color top stripe */}
      <Box position="absolute" top="0" left="0" right="0" h="2px"
        borderRadius="16px 16px 0 0" bg={c.color} opacity={unavail ? 0.3 : 0.8} />

      <Box className="swap-network-arrow" position="absolute" top="4" right="3" color={SWAP_ACCENT[side]}><ArrowRight size={18} /></Box>
      {/* Network identity */}
      <SwapNetworkIcon chainId={c.caip2} size={48} />

      {/* Bottom info */}
      <Box mt="auto">
        <Text fontSize="15px" fontWeight="800" letterSpacing="-0.02em" lineHeight="1.2">{c.name}</Text>
        <Text fontSize="9px" color="kk.textMuted" letterSpacing="0.06em" textTransform="uppercase" mt="0.5">
          {c.family}
        </Text>
        <Text fontSize="11px" fontWeight="500" color={unavail && c.firmwareGated ? "var(--gold)" : "kk.textSecondary"} mt="1.5">
          {unavail ? (c.firmwareGated ? "Update firmware" : "No route") : `${c.routableCount} ${side === "from" ? "held assets" : "assets"}`}
        </Text>
        {/* CAIP-2 */}
        <Text fontSize="8px" color="kk.textMuted" fontFamily="mono" mt="1" whiteSpace="nowrap" opacity={0.6}>
          {ellipsizeCaip(c.caip2)}
        </Text>
      </Box>
    </Box>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TO picker — Step 2: asset list for a network (paginated + search)
// ══════════════════════════════════════════════════════════════════════════

function AssetStep({ entries, chainCaip2, excludeCaip, firmwareVersion, search, onSearchChange,
  onBack, onSelect, onUnavailable }: {
  entries: AssetEntry[]
  chainCaip2: string
  excludeCaip: string | undefined
  firmwareVersion: string | undefined
  search: string
  onSearchChange: (s: string) => void
  onBack: () => void
  onSelect: (e: AssetEntry) => void
  onUnavailable: (e: AssetEntry) => void
}) {
  const chainName = networkDisplayName(chainCaip2)
  const [page, setPage] = useState(0)
  const q = search.trim().toLowerCase()

  // Reset page when search changes
  useEffect(() => { setPage(0) }, [search])

  // A pasted contract/mint address — EVM 0x… or Solana base58. Drives the
  // on-chain "paste a contract" lookup lane below when it matches no catalog row.
  // base58 is only treated as an address on solana:/tron: steps — on EVM steps a
  // base58-looking string is meaningless and would trigger a pointless lookup.
  const addrQuery = useMemo(() => {
    const rawAddr = search.trim()
    if (/^0x[a-fA-F0-9]{40}$/.test(rawAddr)) return rawAddr
    const base58Chain = chainCaip2.startsWith('solana:') || chainCaip2.startsWith('tron:')
    if (base58Chain && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(rawAddr)) return rawAddr
    return null
  }, [search, chainCaip2])

  // Discovery search — fires when in-chain list is empty and query is long enough.
  // Skipped for address queries, which take the dedicated contract-lookup lane.
  const [discoveryHits, setDiscoveryHits] = useState<AssetEntry[]>([])
  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  useEffect(() => {
    let cancelled = false
    setDiscoveryHits([])
    setDiscoveryLoading(false)
    if (addrQuery || q.length < 2) return
    // Only search once the in-chain results are known (after inChain memo runs)
    const timer = setTimeout(async () => {
      setDiscoveryLoading(true)
      try {
        const hits = await rpcRequest<SwapAsset[]>('searchSwapAssets', { query: q })
        // Convert SwapAsset → AssetEntry using caip-derived chainId (CAIP-2)
        const entries: AssetEntry[] = (hits ?? []).flatMap(a => {
          if (!a.caip) return []
          const caip2 = a.caip.split('/')[0]
          if (caip2 !== chainCaip2 || a.caip.toLowerCase() === excludeCaip?.toLowerCase()) return []
          return [{
            caip: a.caip,
            swappable: a,
            symbol: a.symbol,
            name: a.name,
            chainId: caip2,
            decimals: a.decimals,
            iconUrl: a.icon,
            isNative: !a.contractAddress,
            availability: assessWithFirmware(a.caip, firmwareVersion),
          }]
        })
        if (!cancelled) setDiscoveryHits(entries)
      } catch { if (!cancelled) setDiscoveryHits([]) }
      finally { if (!cancelled) setDiscoveryLoading(false) }
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q, addrQuery, firmwareVersion, chainCaip2, excludeCaip])

  const inChain = useMemo(() => entries.filter(e => {
    if (e.chainId !== chainCaip2) return false
    if (e.caip === excludeCaip) return false
    if (q) {
      const text = `${e.symbol} ${e.name}`.toLowerCase()
      const caipLower = (e.caip || '').toLowerCase()
      // Contract/mint match: parse the real contract out of the CAIP (the
      // earlier `(e as any).contractAddress` was always undefined — dead code).
      // base58 is case-sensitive on TRON/Solana, so match case-insensitively.
      const contract = (parseCaip(e.caip).contractAddress || '').toLowerCase()
      if (!text.includes(q) && !caipLower.includes(q) && !contract.includes(q)) return false
    }
    return true
  // Sort: held → stablecoins → native → popularity (catalog rank) → junk → unsupported.
  }).sort(compareForPicker), [entries, chainCaip2, excludeCaip, q])

  const totalPages = Math.ceil(inChain.length / PAGE_SIZE)
  const pageItems  = inChain.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── Paste-a-contract lane ───────────────────────────────────────────────
  // When the query is an address with no catalog match, resolve it on-chain
  // (EVM eth_call / Solana RPC + Jupiter) and offer "Add & select".
  const [contractHit, setContractHit] = useState<SwapAsset | null>(null)
  // The address we've completed a lookup for — distinguishes "still resolving"
  // from "resolved, nothing found" so the empty state never flashes pre-lookup.
  const [searchedAddr, setSearchedAddr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  useEffect(() => {
    if (!addrQuery || inChain.length > 0) { setContractHit(null); setSearchedAddr(null); return }
    let cancelled = false
    setContractHit(null); setSearchedAddr(null)
    const timer = setTimeout(async () => {
      try {
        const res = await rpcRequest<{ hits: SwapAsset[] }>(
          'lookupTokenContract', { contractAddress: addrQuery, chainId: chainCaip2 }, 20000,
        )
        if (cancelled) return
        // Only accept a hit on the network the user is browsing — never silently
        // switch the destination to another chain (e.g. a Solana mint resolved
        // while the EVM step is open) — and exclude the source asset itself. The
        // normal list filters the FROM asset via excludeCaip, but this paste lane
        // bypassed it: pasting the source asset's own contract/mint into the
        // destination picker could re-select it and start a self-swap. Compare
        // case-insensitively to cover EVM address casing.
        setContractHit((res?.hits ?? []).find(h =>
          h.caip?.split('/')[0] === chainCaip2 &&
          (h.caip ?? '').toLowerCase() !== (excludeCaip ?? '').toLowerCase()
        ) ?? null)
      } catch {
        if (!cancelled) setContractHit(null)
      } finally {
        if (!cancelled) setSearchedAddr(addrQuery)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [addrQuery, inChain.length, chainCaip2, excludeCaip])

  const handleAddAndSelect = useCallback(async (hit: SwapAsset) => {
    // Defense in depth: never add+select the source asset (self-swap guard) —
    // mirrors the excludeCaip filter on the normal list and the lookup hit.
    if (!hit.caip || hit.caip.toLowerCase() === (excludeCaip ?? '').toLowerCase()) return
    const entry: AssetEntry = {
      caip: hit.caip,
      symbol: hit.symbol,
      name: hit.name,
      chainId: hit.caip.split('/')[0],
      decimals: hit.decimals,
      iconUrl: hit.icon,
      isNative: !hit.contractAddress,
      swappable: hit,
      availability: assessWithFirmware(hit.caip, firmwareVersion),
    }
    // Honor the same gate as every other row: a firmware-gated (or otherwise
    // unswappable) pasted token routes to the unavailable view instead of being
    // silently added + selected. handleSelect (onSelect) re-guards, but that
    // path would no-op without telling the user why.
    if (!isRowSelectable(entry)) { onUnavailable(entry); return }
    setAdding(true)
    try {
      // Persist (best-effort) so it appears in the catalog on the next open.
      await rpcRequest('addCustomToken', { chainId: hit.chainId, contractAddress: hit.contractAddress }, 30000).catch(() => {})
      onSelect(entry)
    } finally {
      setAdding(false)
    }
  }, [onSelect, onUnavailable, excludeCaip, firmwareVersion])

  return (
    <>
      {/* Search */}
      <SearchBar value={search} onChange={v => { onSearchChange(v) }}
        placeholder={`Search assets on ${chainName}…`} autoFocus />

      {/* List */}
      <Box flex="1" overflowY="auto" px="5" pb="2">
        {inChain.length > 0 ? (
          pageItems.map(e => (
            <AssetListRow key={e.caip} entry={e}
              onSelect={onSelect} onUnavailable={onUnavailable} />
          ))
        ) : addrQuery ? (
          // Pasted-address lane: on-chain lookup → add & select. Show the
          // resolving card until the lookup for THIS address completes, so the
          // empty state can't flash on the frame before the effect runs.
          contractHit ? (
            <ContractHitRow loading={false} hit={contractHit} adding={adding}
              chainName={chainName} onAdd={handleAddAndSelect} />
          ) : searchedAddr === addrQuery ? (
            <Flex direction="column" align="center" py="14" gap="2">
              <Text fontSize="14px" fontWeight="500" color="kk.textSecondary">No token at that address</Text>
              <Text fontSize="11px" color="kk.textMuted">Double-check the contract / mint address.</Text>
            </Flex>
          ) : (
            <ContractHitRow loading hit={null} adding={adding}
              chainName={chainName} onAdd={handleAddAndSelect} />
          )
        ) : discoveryHits.length > 0 ? (
          <>
            <Text fontSize="10px" color="kk.textMuted" mb="2" letterSpacing="0.06em" textTransform="uppercase">
              More assets on {chainName}
            </Text>
            {discoveryHits.map(e => (
              <AssetListRow key={e.caip} entry={e}
                onSelect={onSelect} onUnavailable={onUnavailable} />
            ))}
          </>
        ) : (
          <Flex direction="column" align="center" py="14" gap="2">
            {discoveryLoading
              ? <Text fontSize="11px" color="kk.textMuted">Searching {chainName}…</Text>
              : <>
                  <Text fontSize="14px" fontWeight="500" color="kk.textSecondary">No assets found</Text>
                  <Text fontSize="11px" color="kk.textMuted">Try another asset on {chainName}.</Text>
                  <Box as="button" onClick={onBack} fontSize="11px" color="var(--teal)" mt="2">Choose another network →</Box>
                </>
            }
          </Flex>
        )}
      </Box>

      {/* Pagination + footer */}
      <Flex px="5" py="2.5" borderTop="1px solid" borderColor="kk.border"
        justify="space-between" align="center" flexShrink={0} bg="#101015">
        <Text fontSize="10px" color="kk.textMuted">
          {inChain.length} asset{inChain.length !== 1 ? "s" : ""} on {chainName}
          {totalPages > 1 && ` · page ${page + 1} of ${totalPages}`}
        </Text>
        {totalPages > 1 && (
          <Flex gap="2" align="center">
            <Box as="button" px="2.5" py="1" fontSize="10px" color="kk.textSecondary" fontFamily="inherit"
              bg="rgba(255,255,255,0.04)" border="1px solid" borderColor="kk.border" borderRadius="6px"
              cursor={page > 0 ? "pointer" : "not-allowed"} opacity={page > 0 ? 1 : 0.35}
              _hover={page > 0 ? { bg: "rgba(255,255,255,0.08)" } : {}}
              onClick={() => page > 0 && setPage(p => p - 1)}>
              ← Prev
            </Box>
            <Box as="button" px="2.5" py="1" fontSize="10px" color="kk.textSecondary" fontFamily="inherit"
              bg="rgba(255,255,255,0.04)" border="1px solid" borderColor="kk.border" borderRadius="6px"
              cursor={page < totalPages - 1 ? "pointer" : "not-allowed"} opacity={page < totalPages - 1 ? 1 : 0.35}
              _hover={page < totalPages - 1 ? { bg: "rgba(255,255,255,0.08)" } : {}}
              onClick={() => page < totalPages - 1 && setPage(p => p + 1)}>
              Next →
            </Box>
          </Flex>
        )}
      </Flex>
    </>
  )
}

function AssetListRow({ entry: e, onSelect, onUnavailable }: {
  entry: AssetEntry
  onSelect: (e: AssetEntry) => void
  onUnavailable: (e: AssetEntry) => void
}) {
  const selectable  = isRowSelectable(e)
  const isTryQuote  = e.availability.status === "unknown"
  const chainName   = networkDisplayName(e.chainId)

  return (
    <Box
      as="button" w="100%" textAlign="left" fontFamily="inherit"
      display="flex" alignItems="center" gap="3"
      px="3" py="3"
      bg={e.balance ? "linear-gradient(90deg, rgba(139,227,196,0.04), rgba(255,255,255,0.01))" : "transparent"}
      border="1px solid"
      borderColor={e.balance ? "rgba(139,227,196,0.20)" : "rgba(255,255,255,0.05)"}
      borderRadius="12px" mb="1.5"
      cursor={selectable ? "pointer" : "not-allowed"}
      opacity={selectable ? 1 : 0.45}
      color="kk.textPrimary"
      transition="all 0.12s"
      _hover={selectable ? { bg: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)" } : {}}
      onClick={() => selectable ? onSelect(e) : onUnavailable(e)}
    >
      {/* Icon — 64px */}
      <Box flexShrink={0}>
        <AssetIcon caip={e.caip} iconUrl={e.iconUrl} chainCaip={chainBadgeCaip(e)} size={64} alt={e.symbol} />
      </Box>

      {/* Info */}
      <Box flex="1" minW="0">
        <Flex align="center" gap="2" flexWrap="wrap">
          <Text fontSize="15px" fontWeight="800">{e.symbol}</Text>
          <GasTokenBadge entry={e} />
          {e.balance && (
            <Box bg="rgba(139,227,196,0.12)" color="var(--teal)" px="1.5" py="0.5"
              borderRadius="4px" fontSize="9px" fontWeight="600" letterSpacing="0.04em">
              HELD · {e.balance.amount}
            </Box>
          )}
          {!e.balance && isTryQuote && (
            <Box bg="rgba(233,196,106,0.10)" color="var(--gold)" px="1.5" py="0.5"
              borderRadius="4px" fontSize="9px" fontWeight="600" letterSpacing="0.04em">
              TRY QUOTE
            </Box>
          )}
          {!selectable && !isTryQuote && (
            <Box bg="rgba(255,255,255,0.04)" color="kk.textMuted" px="1.5" py="0.5"
              borderRadius="4px" fontSize="9px" fontWeight="600" letterSpacing="0.04em">
              UNAVAILABLE
            </Box>
          )}
        </Flex>
        {/* Name + network — distinguishes USDC-on-Ethereum from USDC-on-Optimism */}
        <Text fontSize="12px" color="kk.textMuted" mt="0.5">
          {e.name} · <Text as="span" color="kk.textSecondary" fontWeight="600">{chainName}</Text>
        </Text>
        {/* Full CAIP-19 */}
        <Text fontSize="9px" color="kk.textMuted" fontFamily="mono" mt="1" opacity={0.55} whiteSpace="nowrap">
          {ellipsizeCaip(e.caip)}
        </Text>
      </Box>

      {/* Right: balance or routes */}
      <Flex direction="column" align="flex-end" gap="1" flexShrink={0}>
        {e.balance && (
          <Text fontSize="11px" fontVariantNumeric="tabular-nums" color="kk.textSecondary">
            {e.balance.amount}
          </Text>
        )}
        <ProviderDots providers={e.availability.providers} />
        {e.availability.providers.length > 0 && (
          <Text fontSize="9px" color="kk.textMuted">
            {e.availability.providers.length} {e.availability.providers.length === 1 ? "route" : "routes"}
          </Text>
        )}
      </Flex>
    </Box>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Pasted-contract lookup row — on-chain resolved token with "Add & select"
// ══════════════════════════════════════════════════════════════════════════

function ContractHitRow({ loading, hit, adding, chainName, onAdd }: {
  loading: boolean
  hit: SwapAsset | null
  adding: boolean
  chainName: string
  onAdd: (hit: SwapAsset) => void
}) {
  if (loading || !hit) {
    return (
      <Flex align="center" gap="3" px="3.5" py="4"
        bg="rgba(233,196,106,0.04)" border="1px dashed rgba(233,196,106,0.22)" borderRadius="12px">
        <Box w="8px" h="8px" borderRadius="full" bg="var(--gold)" opacity={0.8}
          style={{ animation: "kkSwapFadeIn 0.6s ease-in-out infinite alternate" }} />
        <Box>
          <Text fontSize="12px" color="kk.textPrimary" fontWeight="600">Looking up token…</Text>
          <Text fontSize="10px" color="kk.textMuted">Resolving the address on {chainName}</Text>
        </Box>
      </Flex>
    )
  }
  const badgeCaip = hit.contractAddress && hit.caip
    ? chainMetaForCaip2(hit.caip.split("/")[0])?.nativeCaip
    : undefined
  return (
    <>
      <Text fontSize="10px" color="kk.textMuted" mb="2" letterSpacing="0.06em" textTransform="uppercase">
        Found via contract address
      </Text>
      <Flex align="center" gap="3" px="3.5" py="3"
        bg="rgba(233,196,106,0.05)" border="1px solid rgba(233,196,106,0.25)" borderRadius="12px">
        <Box flexShrink={0}>
          <AssetIcon caip={hit.caip!} iconUrl={hit.icon} chainCaip={badgeCaip} size={56} alt={hit.symbol} />
        </Box>
        <Box flex="1" minW="0">
          <Flex align="center" gap="2">
            <Text fontSize="15px" fontWeight="800">{hit.symbol}</Text>
            <Box bg="rgba(233,196,106,0.10)" color="var(--gold)" px="1.5" py="0.5"
              borderRadius="4px" fontSize="9px" fontWeight="600" letterSpacing="0.04em">NEW · TRY QUOTE</Box>
          </Flex>
          <Text fontSize="12px" color="kk.textMuted" mt="0.5">{hit.name} · {hit.decimals} decimals</Text>
          <Text fontSize="9px" color="kk.textMuted" fontFamily="mono" mt="1" opacity={0.55}
            whiteSpace="nowrap">{ellipsizeCaip(hit.caip!)}</Text>
        </Box>
        <Box as="button" flexShrink={0} fontFamily="inherit"
          px="3.5" py="2" borderRadius="10px" bg="var(--gold)" color="#0b0b0e"
          fontSize="11px" fontWeight="700" border="none"
          cursor={adding ? "wait" : "pointer"} opacity={adding ? 0.6 : 1}
          _hover={adding ? {} : { filter: "brightness(1.08)" }}
          disabled={adding}
          onClick={() => !adding && onAdd(hit)}>
          {adding ? "Adding…" : "Add & select"}
        </Box>
      </Flex>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Unavailable route view
// ══════════════════════════════════════════════════════════════════════════

function UnavailableRouteView({ target, entries, onBack, onAltSelect }: {
  target: AssetEntry
  entries: AssetEntry[]
  onBack: () => void
  onAltSelect: (e: AssetEntry) => void
}) {
  const sym = target.symbol
  const targetChainName = networkDisplayName(target.chainId)

  const alternatives = useMemo(() =>
    entries.filter(e => e.caip !== target.caip && e.symbol === sym && isRowSelectable(e))
      .sort((a, b) => b.availability.providers.length - a.availability.providers.length),
    [entries, target, sym]
  )

  return (
    <>
      <Flex align="center" gap="2" mx="5" mb="2.5" flexShrink={0}>
        <Box as="button" display="inline-flex" alignItems="center" gap="1.5"
          bg="transparent" border="none" cursor="pointer" color="kk.textSecondary"
          px="2" py="1" borderRadius="8px" fontFamily="inherit" fontSize="11px"
          _hover={{ color: "kk.textPrimary", bg: "rgba(255,255,255,0.05)" }}
          onClick={onBack}>
          <BackIcon /> Back to {targetChainName}
        </Box>
      </Flex>

      <Box flex="1" overflowY="auto" px="5" pb="4">
        {/* Hero */}
        <Flex direction="column" align="center" gap="3" p="5" mb="5"
          bg="linear-gradient(180deg, rgba(224,140,123,0.06), transparent)"
          border="1px solid rgba(224,140,123,0.18)" borderRadius="18px" textAlign="center">
          <Box w="56px" h="56px" borderRadius="full" bg="rgba(224,140,123,0.10)"
            display="grid" placeItems="center" color="var(--rose)">
            <AlertIcon />
          </Box>
          <Text fontSize="17px" fontWeight="500" letterSpacing="-0.01em" color="kk.textPrimary">
            {target.availability.status === "unsupported_firmware"
              ? `${sym} needs a firmware update`
              : `${sym} on ${targetChainName} isn't routable`}
          </Text>
          <Text fontSize="12px" color="kk.textSecondary" lineHeight="1.6" maxW="440px">
            {target.availability.status === "unsupported_firmware"
              ? (target.availability.reason ?? `Update your KeepKey to swap ${sym} on ${targetChainName}.`)
              : target.availability.status === "unsupported_token"
              ? `${targetChainName} natives swap fine, but this specific token isn't on any provider's list yet.`
              : `${targetChainName} isn't supported by any of our routers yet (THORChain, Mayachain, Relay, 0x, ChainFlip).`}
          </Text>
          <Box display="inline-flex" alignItems="center" gap="1.5"
            px="3.5" py="2" bg="rgba(233,196,106,0.06)" border="1px solid rgba(233,196,106,0.20)"
            borderRadius="10px" color="var(--gold)" fontFamily="inherit" fontSize="11px" fontWeight="600"
            opacity={0.5} cursor="not-allowed" title="Notifications coming soon">
            <BellIcon /> Notify me when supported
          </Box>
        </Flex>

        {/* Alternatives */}
        {alternatives.length > 0 ? (
          <>
            <Flex align="center" gap="2" mb="2.5">
              <Text fontSize="10px" color="var(--gold)">◆</Text>
              <Text fontSize="10px" color="kk.textMuted" letterSpacing="0.12em" textTransform="uppercase">
                Find {sym} on another network
              </Text>
            </Flex>
            <Flex direction="column" gap="1.5">
              {alternatives.map(a => {
                const chainName = networkDisplayName(a.chainId)
                return (
                  <Box key={a.caip} as="button" w="100%" textAlign="left" fontFamily="inherit"
                    display="flex" alignItems="center" gap="3"
                    px="3.5" py="3"
                    bg="rgba(255,255,255,0.02)" border="1px solid rgba(255,255,255,0.06)"
                    borderRadius="12px" cursor="pointer" color="kk.textPrimary"
                    transition="all 0.15s"
                    _hover={{ bg: "rgba(255,255,255,0.05)", borderColor: "rgba(233,196,106,0.30)", transform: "translateX(2px)" }}
                    onClick={() => onAltSelect(a)}>
                    <AssetIcon caip={a.caip} iconUrl={a.iconUrl} chainCaip={chainBadgeCaip(a)} size={48} alt={a.symbol} />
                    <Box flex="1" minW="0">
                      <Flex align="center" gap="2">
                        <Text fontSize="13px" fontWeight="600">{a.symbol}</Text>
                        {a.balance && (
                          <Box bg="rgba(139,227,196,0.12)" color="var(--teal)" px="1.5" py="0.5"
                            borderRadius="4px" fontSize="9px" fontWeight="600">HELD</Box>
                        )}
                      </Flex>
                      <Text fontSize="11px" color="var(--teal)" mt="0.5">View assets on {chainName} →</Text>
                      <Text fontSize="9px" color="kk.textMuted" fontFamily="mono" mt="1" opacity={0.55} whiteSpace="nowrap">{ellipsizeCaip(a.caip)}</Text>
                    </Box>
                    <Flex align="center" gap="1.5" px="2.5" py="1"
                      bg="rgba(139,227,196,0.08)" border="1px solid rgba(139,227,196,0.25)"
                      borderRadius="999px" flexShrink={0}>
                      <ProviderDots providers={a.availability.providers} />
                      <Text fontSize="10px" color="var(--teal)" fontWeight="600">
                        {a.availability.providers.length} {a.availability.providers.length === 1 ? "route" : "routes"}
                      </Text>
                    </Flex>
                    <Box color="kk.textMuted" flexShrink={0}><ArrowRight size={14} /></Box>
                  </Box>
                )
              })}
            </Flex>
          </>
        ) : (
          <Box p="4" bg="rgba(255,255,255,0.03)" border="1px dashed rgba(255,255,255,0.08)"
            borderRadius="12px" fontSize="11px" color="kk.textSecondary" lineHeight="1.6">
            No other supported network lists {sym}. Try a different destination asset.
          </Box>
        )}
      </Box>

      <Flex px="5" py="2.5" borderTop="1px solid" borderColor="kk.border"
        justify="space-between" align="center" flexShrink={0} bg="#101015">
        <Text fontSize="10px" color="kk.textMuted">Availability is checked when you request a quote.</Text>
        <Box as="button" px="3" py="1.5" bg="rgba(255,255,255,0.05)" border="1px solid" borderColor="kk.border"
          borderRadius="8px" fontSize="11px" color="kk.textSecondary" cursor="pointer" fontFamily="inherit"
          _hover={{ bg: "rgba(255,255,255,0.08)" }} onClick={onBack}>
          Try a different asset
        </Box>
      </Flex>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Props + main component
// ══════════════════════════════════════════════════════════════════════════

interface AssetPickerDialogProps {
  open: boolean
  onClose: () => void
  swappable: SwapAsset[]
  balances: ChainBalance[]
  balancesLoading?: boolean
  customTokens?: CustomToken[]
  excludeCaip?: string
  onSelect: (asset: SwapAsset) => void
  side: "from" | "to"
}

export function AssetPickerDialog({
  open, onClose, swappable, balances, balancesLoading = false, customTokens, excludeCaip, onSelect, side,
}: AssetPickerDialogProps) {
  const { fmtCompact, privateModeEnabled } = useFiat()
  // Connected device's firmware version — gates chains whose `minFirmware` the
  // device can't meet (e.g. ZEC needs 7.15.0). Undefined until the first device-
  // state fetch resolves, which fails closed (firmware-restricted chains hidden).
  const { firmwareVersion } = useDeviceState()

  const [entries, setEntries]         = useState<AssetEntry[] | null>(null)
  const [loading, setLoading]         = useState(false)
  const [selectedChain, setSelectedChain]         = useState<string | null>(null)
  const [unavailEntry, setUnavailEntry] = useState<AssetEntry | null>(null)
  const [search, setSearch]           = useState("")
  const dialogRef = useRef<HTMLDivElement>(null)

  // Build entry list on open
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    buildAssetEntries({ swappable, balances, customTokens, firmwareVersion })
      .then(list => { if (!cancelled) { setEntries(list); setLoading(false) } })
      .catch(e => {
        if (cancelled) return
        console.error("[AssetPickerDialog] buildAssetEntries failed:", e)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [open, swappable, balances, customTokens, firmwareVersion])

  // Reset before paint so reopening never flashes the previous network’s assets.
  useLayoutEffect(() => {
    if (open) {
      setSelectedChain(null)
      setUnavailEntry(null)
      setSearch("")
    }
  }, [open, side])

  // Keep keyboard navigation inside the picker while it is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return }
      if (e.key !== "Tab") return
      const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]):not([aria-disabled="true"]), input') ?? [])]
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        e.preventDefault(); first.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || loading) return
    // Moving between stages removes the focused row/input. Focus the new
    // search field, or the dialog heading, without stealing focus
    // from a control that remains mounted.
    if (!dialogRef.current?.contains(document.activeElement)) {
      (dialogRef.current?.querySelector<HTMLInputElement>("input") ?? dialogRef.current)?.focus()
    }
  }, [open, loading, selectedChain, unavailEntry])

  // Source networks come from holdings; destinations come from the catalog.
  const chainInfos = useMemo(() => {
    if (!entries) return []
    return buildChainInfos(side === "from" ? entries.filter(e => e.balance) : entries, excludeCaip)
  }, [entries, excludeCaip, side])

  // Asset selection completes this picker. Transaction review stays in SwapDialog.
  const handleSelect = useCallback((entry: AssetEntry) => {
    if (!selectedChain || entry.chainId !== selectedChain || !isRowSelectable(entry)) return
    const base = entry.swappable ?? synthesizeSwapAsset(entry)
    if (!base) {
      console.warn("[AssetPickerDialog] No vault chain config for", entry.chainId)
      return
    }
    const asset = base.caip === entry.caip ? base : { ...base, caip: entry.caip }
    onSelect(asset)
    onClose()
  }, [onSelect, onClose, selectedChain])

  if (!open) return null

  const resetNetwork = () => { setSelectedChain(null); setSearch(""); setUnavailEntry(null) }
  const accent = SWAP_ACCENT[side]
  const step = selectedChain ? 1 : 0
  const title = unavailEntry ? "Route unavailable"
    : selectedChain ? "Choose an asset"
    : side === "from" ? "Choose your source network" : "Choose your destination network"

  return (
    <Box className="swap-selection" style={{ "--swap-accent": accent } as CSSProperties} position="fixed" inset="0" zIndex={Z.assetPicker}
      display="flex" alignItems="center" justifyContent="center"
      bg="rgba(11,11,14,0.28)"
      backdropFilter="blur(20px) saturate(140%)"
      onClick={onClose}>
      <Box
        ref={dialogRef} tabIndex={-1} outline="none" role="dialog" aria-modal="true" aria-labelledby="swap-picker-title"
        position="relative"
        borderRadius="22px"
        border="1px solid rgba(255,255,255,0.10)"
        w="700px" maxW="96vw" h="640px" maxH="88vh"
        display="flex" flexDirection="column"
        overflow="hidden"
        fontFamily="'Geist Mono', ui-monospace, monospace"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)), rgba(16,16,21,0.78)",
          backdropFilter: "blur(32px) saturate(160%)",
          WebkitBackdropFilter: "blur(32px) saturate(160%)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px -16px rgba(0,0,0,0.8), 0 4px 12px -4px rgba(0,0,0,0.5)",
        }}
        _before={{
          content: '""', position: "absolute", inset: "0",
          bg: `radial-gradient(800px 400px at 50% -10%, ${accent}18, transparent 60%)`,
          pointerEvents: "none", zIndex: 0,
        }}
      >
        {/* Header */}
        <Flex align="center" justify="space-between" px="5" pt="4.5" pb="3.5" flexShrink={0} zIndex={1}>
          <Box>
            <Text fontSize="10px" letterSpacing="0.12em" textTransform="uppercase" color={accent} mb="1">
              {side === "from" ? "↗ You send" : "↙ You receive"}
            </Text>
            <Text id="swap-picker-title" fontSize="18px" fontWeight="700" letterSpacing="-0.02em" color="kk.textPrimary">
              {title}
            </Text>
          </Box>
          <Box as="button" aria-label="Close asset picker" w="28px" h="28px" borderRadius="8px" bg="transparent" border="none"
            color="kk.textMuted" cursor="pointer" display="grid" placeItems="center"
            _hover={{ bg: "rgba(255,255,255,0.05)", color: "kk.textPrimary" }}
            onClick={onClose}>
            <CloseIcon />
          </Box>
        </Flex>

        <SwapPickerProgress step={step} side={side} onNetwork={resetNetwork} />
        {selectedChain && !unavailEntry && (
          <Flex mx="5" mb="3" px="3" py="2.5" gap="3" align="center" justify="space-between" flexShrink={0}
            borderRadius="12px" bg={`${accent}08`} border="1px solid" borderColor={`${accent}26`}>
            <Box minW="0">
              <SwapNetworkBadge chainId={selectedChain} side={side} />
            </Box>
            <Box as="button" onClick={resetNetwork} color="kk.textSecondary" fontSize="11px" flexShrink={0}>
              Change network
            </Box>
          </Flex>
        )}
        {/* Body */}
        <Box flex="1" minH="0" display="flex" flexDirection="column" zIndex={1}>
          {loading ? (
            <Flex flex="1" align="center" justify="center">
              <Text fontSize="12px" color="kk.textMuted">Loading…</Text>
            </Flex>
          ) : !entries ? null
          : unavailEntry ? (
            <UnavailableRouteView
              target={unavailEntry}
              entries={entries.filter(e => e.caip !== excludeCaip)}
              onBack={() => setUnavailEntry(null)}
              onAltSelect={(e) => { setUnavailEntry(null); setSelectedChain(e.chainId); setSearch("") }}
            />
          ) : selectedChain ? (side === "from" ? (
            <FromPicker key={selectedChain} entries={entries.filter(e => e.caip !== excludeCaip)} chainCaip2={selectedChain}
              onSelect={handleSelect} fmtCompact={fmtCompact} privateModeEnabled={privateModeEnabled} balancesLoading={balancesLoading} />
          ) : (
            <AssetStep key={selectedChain}
              entries={entries}
              chainCaip2={selectedChain}
              excludeCaip={excludeCaip}
              firmwareVersion={firmwareVersion}
              search={search}
              onSearchChange={setSearch}
              onBack={resetNetwork}
              onSelect={handleSelect}
              onUnavailable={setUnavailEntry}
            />
          )) : (
            <ChainStep
              chainInfos={chainInfos}
              side={side}
              balancesLoading={balancesLoading}
              search={search}
              onSearchChange={setSearch}
              onPickChain={(caip2) => { setSelectedChain(caip2); setSearch("") }}
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}
