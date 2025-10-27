'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Text,
  Stack,
  Flex,
  Input,
  IconButton,
  VStack,
  Image,
  Textarea,
  Spinner,
  CloseButton,
} from '@chakra-ui/react'
import { Skeleton } from '@/components/ui/skeleton'
import { usePioneerContext } from '@/components/providers/pioneer'
import { FeeSelection, type FeeLevel } from '@/components/FeeSelection'
import { FaArrowRight, FaPaperPlane, FaTimes, FaWallet, FaExternalLinkAlt, FaCheck, FaCopy, FaPlus, FaChevronDown, FaChevronUp } from 'react-icons/fa'
import Confetti from 'react-confetti'
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph'
import { keyframes } from '@emotion/react'
import { usePathManager } from '@/hooks/usePathManager'
import { PathFormInputs } from '@/components/path/PathFormInputs'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '@/components/ui/dialog'
import { AssetHeaderCard } from './AssetHeaderCard'
import ChangeControl from './ChangeControl'
import { enrichPubkeysWithUsageInfo, isUTXONetwork } from '@/utils/utxoAddressUtils'
import { ReviewTransaction } from './ReviewTransaction'
import { formatTransactionDetails as formatTxDetails, type NetworkType } from '@/utils/transactionFormatter'
import {
  formatUsd as formatUsdValue,
  usdToNative as convertUsdToNative,
  nativeToUsd as convertNativeToUsd,
  isPriceAvailable as checkPriceAvailable,
  calculateFeeInUsd as calcFeeInUsd
} from '@/utils/currencyConverter'

// Add sound effect imports
const wooshSound = typeof Audio !== 'undefined' ? new Audio('/sounds/woosh.mp3') : null;
const chachingSound = typeof Audio !== 'undefined' ? new Audio('/sounds/chaching.mp3') : null;

// Play sound utility function
const playSound = (sound: HTMLAudioElement | null) => {
  if (sound) {
    sound.currentTime = 0; // Reset to start
    sound.play().catch(err => console.error('Error playing sound:', err));
  }
};

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  border: '#3A4A5C',
  formPadding: '16px', // Added for consistent form padding
  borderRadius: '12px', // Added for consistent border radius
}

// Define animation keyframes
const scale = keyframes`
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
`

interface SendProps {
  onBackClick?: () => void
}

interface Pubkey {
  address?: string;
  master?: string;
  pubkey?: string;
  note: string;
  pathMaster: string;
  networks: string[];
  scriptType?: string;
  // UTXO address usage info
  receiveIndex?: number;
  changeIndex?: number;
  usedReceiveAddresses?: number;
  usedChangeAddresses?: number;
}

// Tendermint networks with memo support
const TENDERMINT_SUPPORT = [
  'cosmos:mayachain-mainnet-v1/slip44:931',
  'cosmos:osmosis-1/slip44:118',
  'cosmos:cosmoshub-4/slip44:118',
  'cosmos:kaiyo-1/slip44:118',
  'cosmos:thorchain-mainnet-v1/slip44:931',
]

// Other networks with special tag fields
const OTHER_SUPPORT = ['ripple:4109c6f2045fc7eff4cde8f9905d19c2/slip44:144']

// Add network classification constants at the top after existing constants
const UTXO_NETWORKS = [
  'bip122:000000000019d6689c085ae165831e93', // Bitcoin
  'bip122:12a765e31ffd4059bada1e25190f6e98', // Litecoin
  'bip122:000000000933ea01ad0ee984209779ba', // Dogecoin
  'bip122:000000000000000000651ef99cb9fcbe', // Bitcoin Cash
]

const EVM_NETWORKS = [
  'eip155:1',     // Ethereum
  'eip155:56',    // BSC
  'eip155:137',   // Polygon
  'eip155:43114', // Avalanche
  'eip155:8453',  // Base
  'eip155:10',    // Optimism
  'eip155:42161', // Arbitrum
]

// TypeScript interfaces for transaction data
interface SendPayload {
  caip: string;
  to: string;
  amount: string;
  feeLevel: number;
  isMax: boolean;
  memo?: string;
  changeScriptType?: string; // Optional: specify change address script type
}

interface TransactionState {
  method: string;
  caip: string;
  params: SendPayload;
  unsignedTx: any;
  signedTx: any;
  state: string;
  context: any;
}

const Send: React.FC<SendProps> = ({ onBackClick }) => {
  // Dialog state
  const [showConfirmation, setShowConfirmation] = useState(false)
  const openConfirmation = () => setShowConfirmation(true)
  const closeConfirmation = () => setShowConfirmation(false)

  // Add Path dialog state
  const [showAddPathDialog, setShowAddPathDialog] = useState(false)
  const openAddPathDialog = () => setShowAddPathDialog(true)
  const closeAddPathDialog = () => setShowAddPathDialog(false)
  
  const pioneer = usePioneerContext()
  const { state } = pioneer
  const { app } = state
  const assetContext = app?.assetContext
  
  // Get the asset color dynamically, with fallback based on asset
  const getAssetColor = () => {
    if (assetContext?.color) return assetContext.color;
    
    // Fallback colors for common assets
    const symbol = assetContext?.symbol?.toUpperCase();
    switch(symbol) {
      case 'BTC': return '#F7931A';  // Bitcoin orange
      case 'ETH': return '#627EEA';  // Ethereum purple  
      case 'BCH': return '#8DC351';  // Bitcoin Cash green
      case 'LTC': return '#BFBBBB';  // Litecoin silver
      case 'DOGE': return '#C2A633'; // Dogecoin gold
      default: return '#F7931A';   // Default to Bitcoin orange
    }
  };
  
  const assetColor = getAssetColor();
  const assetColorHover = `${assetColor}CC`; // Add transparency for hover
  const assetColorLight = `${assetColor}22`; // 22 = ~13% opacity

  // State for input fields
  const [amount, setAmount] = useState<string>('')
  const [recipient, setRecipient] = useState<string>('')
  const [memo, setMemo] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [balance, setBalance] = useState<string>('0')
  const [totalBalanceUsd, setTotalBalanceUsd] = useState<number>(0)
  const [selectedPubkey, setSelectedPubkey] = useState<Pubkey | null>(null)
  const [nativeGasBalance, setNativeGasBalance] = useState<string>('0') // CACAO/gas balance for selected pubkey

  // Add state to track if we're entering amount in USD
  const [isUsdInput, setIsUsdInput] = useState<boolean>(false)

  // State for change address script type (for UTXO chains)
  const [changeScriptType, setChangeScriptType] = useState<string | undefined>(undefined)
  
  // Transaction state
  const [txHash, setTxHash] = useState<string>('')
  const [txSuccess, setTxSuccess] = useState<boolean>(false)
  const [isMax, setIsMax] = useState<boolean>(false)
  const [unsignedTx, setUnsignedTx] = useState<any>(null)
  const [signedTx, setSignedTx] = useState<any>(null)
  const [transactionStep, setTransactionStep] = useState<'review' | 'sign' | 'broadcast' | 'success'>('review')
  const [estimatedFee, setEstimatedFee] = useState<string>('0.0001')
  // Add state for fee in USD
  const [estimatedFeeUsd, setEstimatedFeeUsd] = useState<string>('0.00')
  
  // Add states for fee adjustment and transaction details
  const [showTxDetails, setShowTxDetails] = useState<boolean>(false)
  const [selectedFeeLevel, setSelectedFeeLevel] = useState<'slow' | 'average' | 'fastest'>('average')
  const [customFeeOption, setCustomFeeOption] = useState<boolean>(false)
  const [customFeeAmount, setCustomFeeAmount] = useState<string>('')
  const [normalizedFees, setNormalizedFees] = useState<any>(null)
  const [feeOptions, setFeeOptions] = useState<{slow: string, average: string, fastest: string}>({ slow: '0', average: '0', fastest: '0' })
  // Add state for raw transaction dialog
  const [showRawTxDialog, setShowRawTxDialog] = useState<boolean>(false)
  const [rawTxJson, setRawTxJson] = useState<string>('')
  const [editedRawTxJson, setEditedRawTxJson] = useState<string>('')

  // Add a state to track if asset data has loaded
  const [assetLoaded, setAssetLoaded] = useState<boolean>(false)

  // Add state for the resolved network ID (without wildcards)
  const [resolvedNetworkId, setResolvedNetworkId] = useState<string>('')
  
  // Fee options are now handled by the FeeSelection component
  
  // Manual copy to clipboard implementation
  const [hasCopied, setHasCopied] = useState(false)
  const copyToClipboard = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash)
        .then(() => {
          setHasCopied(true)
          setTimeout(() => setHasCopied(false), 2000)
        })
        .catch(err => {
          console.error('Error copying to clipboard:', err)
        })
    }
  }

  // Add state for TX building loading indicators
  const [isBuildingTx, setIsBuildingTx] = useState<boolean>(false)

  // Add state for error handling
  const [error, setError] = useState<string | null>(null)
  const [showErrorDialog, setShowErrorDialog] = useState<boolean>(false)

  // Add state for showing advanced options (custom path)
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false)

  // Path manager hook for adding custom paths
  const pathManager = usePathManager({ assetContext, app })

  // Calculate total balance - sum all pubkey balances for UTXO chains
  useEffect(() => {
    console.log('🔄 [Send useEffect] Balance calculation triggered', {
      hasAssetContext: !!assetContext,
      hasSelectedPubkey: !!selectedPubkey,
      selectedPubkeyAddress: selectedPubkey?.address,
      balancesCount: app?.balances?.length || 0,
      currentBalance: balance
    });

    if (assetContext) {
      try {
        // Resolve and store the network ID
        const resolved = resolveNetworkId(assetContext);
        if (resolved) {
          setResolvedNetworkId(resolved);
        }

        // Store previous balance for comparison
        const prevBalance = balance;
        
        let newBalance = '0';
        
        // Check if this is a UTXO network (Bitcoin, etc.)
        const networkId = assetContext.networkId || assetContext.caip || '';
        const isUtxoNetwork = UTXO_NETWORKS.some(id => networkId.includes(id)) || networkId.startsWith('bip122:');
        
        if (isUtxoNetwork && assetContext.pubkeys && assetContext.pubkeys.length > 0) {
          // For UTXO chains, sum all pubkey balances
          console.log('Calculating UTXO balance from pubkeys:', assetContext.pubkeys);

          const assetCaip = assetContext.caip || assetContext.networkId;
          let totalBalance = 0;

          for (const pubkey of assetContext.pubkeys) {
            // Find corresponding balance for this pubkey
            // CRITICAL: Must match BOTH the address AND the asset CAIP
            const pubkeyBalance = app?.balances?.find((b: any) => {
              // First check if this balance is for the correct asset
              const isCorrectAsset = b.caip === assetCaip ||
                                   b.networkId === assetCaip ||
                                   b.symbol === assetContext.symbol;

              if (!isCorrectAsset) {
                return false;
              }

              // Then match by pubkey/address/master
              return b.pubkey === pubkey.pubkey ||
                     b.address === pubkey.address ||
                     b.master === pubkey.master;
            });

            if (pubkeyBalance && pubkeyBalance.balance) {
              const balanceValue = parseFloat(pubkeyBalance.balance);
              if (!isNaN(balanceValue)) {
                totalBalance += balanceValue;
                console.log(`Added balance for ${pubkey.addressType || 'address'}: ${balanceValue}`);
              }
            }
          }

          newBalance = totalBalance.toFixed(8);
          console.log('Total UTXO balance calculated:', newBalance);
        } else {
          // For non-UTXO chains
          // When a specific pubkey is selected, ALWAYS look up its balance
          // This is critical for native assets like MAYA that may be classified as tokens
          if (selectedPubkey) {
            // For native assets, use the selected pubkey's balance
            console.log('🔍 [Send] Looking for balance for selected pubkey:', {
              address: selectedPubkey.address,
              master: selectedPubkey.master,
              pubkey: selectedPubkey.pubkey,
              note: selectedPubkey.note,
              caip: selectedPubkey.caip,
              availableBalances: app?.balances?.length || 0
            });

            // Log all available balances for debugging
            if (app?.balances && app.balances.length > 0) {
              console.log('🔍 [Send] Available balances:', app.balances.map((b: any) => ({
                address: b.address,
                pubkey: b.pubkey,
                master: b.master,
                caip: b.caip,
                balance: b.balance
              })));
            }

            // Try multiple matching strategies to find the balance
            // CRITICAL: Must match BOTH the address AND the asset CAIP
            const assetCaip = assetContext.caip || assetContext.networkId;
            const pubkeyBalance = app?.balances?.find((b: any) => {
              // First check if this balance is for the correct asset
              const isCorrectAsset = b.caip === assetCaip ||
                                   b.networkId === assetCaip ||
                                   b.symbol === assetContext.symbol;

              if (!isCorrectAsset) {
                return false;
              }

              // Now check if this balance is for the selected pubkey
              // Match by exact pubkey
              if (b.pubkey === selectedPubkey.pubkey) {
                console.log('✅ [Send] Matched by pubkey:', b.pubkey, 'for asset:', assetCaip);
                return true;
              }
              // Match by address
              if (b.pubkey === selectedPubkey.address || b.address === selectedPubkey.address) {
                console.log('✅ [Send] Matched by address:', selectedPubkey.address, 'for asset:', assetCaip);
                return true;
              }
              // Match by master
              if (b.master === selectedPubkey.master || b.address === selectedPubkey.master) {
                console.log('✅ [Send] Matched by master:', selectedPubkey.master, 'for asset:', assetCaip);
                return true;
              }
              return false;
            });

            if (pubkeyBalance && pubkeyBalance.balance) {
              newBalance = parseFloat(pubkeyBalance.balance).toFixed(8);
              console.log('✅ [Send] Found balance for selected pubkey:', {
                balance: newBalance,
                matchedBy: pubkeyBalance.address || pubkeyBalance.pubkey || pubkeyBalance.master,
                pubkeyNote: selectedPubkey.note
              });
            } else {
              console.warn('⚠️ [Send] No balance found for selected pubkey, defaulting to 0', {
                selectedPubkey,
                balancesCount: app?.balances?.length || 0
              });
              newBalance = '0';
            }
          } else {
            // If no pubkey selected yet, use the first pubkey's balance or assetContext balance
            if (assetContext.pubkeys && assetContext.pubkeys.length > 0) {
              const firstPubkey = assetContext.pubkeys[0];
              const assetCaip = assetContext.caip || assetContext.networkId;

              const pubkeyBalance = app?.balances?.find((b: any) => {
                // First check if this balance is for the correct asset
                const isCorrectAsset = b.caip === assetCaip ||
                                     b.networkId === assetCaip ||
                                     b.symbol === assetContext.symbol;

                if (!isCorrectAsset) {
                  return false;
                }

                // Then match by pubkey/address
                return b.pubkey === firstPubkey.pubkey ||
                       b.pubkey === firstPubkey.address ||
                       b.address === firstPubkey.address ||
                       b.master === firstPubkey.master ||
                       b.address === firstPubkey.master;
              });

              if (pubkeyBalance && pubkeyBalance.balance) {
                newBalance = parseFloat(pubkeyBalance.balance).toFixed(8);
                console.log('✅ [Send] Using first pubkey balance for non-UTXO chain:', newBalance);
              } else {
                newBalance = assetContext.balance || '0';
                console.log('ℹ️ [Send] Using assetContext balance:', newBalance);
              }
            } else {
              newBalance = assetContext.balance || '0';
              console.log('ℹ️ [Send] Using assetContext balance (no pubkeys):', newBalance);
            }
          }
        }

        setBalance(newBalance)
        setTotalBalanceUsd(parseFloat(newBalance) * (assetContext.priceUsd || 0))
        setAssetLoaded(true)
        setLoading(false)
        
        // Play chaching sound if balance increased
        if (prevBalance && newBalance && parseFloat(newBalance) > parseFloat(prevBalance)) {
          // playSound(chachingSound); // Disabled - sound is annoying
          console.log('Balance increased! 💰', { previous: prevBalance, new: newBalance });
        }
        
        // Also update fee in USD when asset context changes
        updateFeeInUsd(estimatedFee);
        
        // Fetch fee rates for the current blockchain
        fetchFeeRates();
      } catch (e) {
        console.error('Error setting balance:', e)
        setBalance('0')
        setTotalBalanceUsd(0)
        setLoading(false)
      }
    } else {
      // Check if context is available after a short delay
      const timer = setTimeout(() => {
        if (!assetLoaded) setLoading(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [assetContext, assetLoaded, estimatedFee, selectedPubkey, app?.balances])

  // Initialize selected pubkey when component mounts or assetContext changes
  useEffect(() => {
    if (assetContext?.pubkeys && assetContext.pubkeys.length > 0 && !selectedPubkey) {
      // Sort pubkeys - prioritize Native Segwit for Bitcoin
      const sortedPubkeys = [...assetContext.pubkeys].sort((a: Pubkey, b: Pubkey) => {
        // Bitcoin - Native Segwit (bc1...) should come first
        if (a.note?.includes('Native Segwit') && !b.note?.includes('Native Segwit')) return -1;
        if (!a.note?.includes('Native Segwit') && b.note?.includes('Native Segwit')) return 1;

        // Otherwise maintain order
        return 0;
      });

      const firstPubkey = sortedPubkeys[0] as Pubkey;
      setSelectedPubkey(firstPubkey);

      // Set the initial pubkey context
      if (app?.setPubkeyContext) {
        app.setPubkeyContext(firstPubkey)
          .then(() => {
            console.log('✅ [Send] Initial pubkey context set:', firstPubkey);
          })
          .catch((error: Error) => {
            console.error('❌ [Send] Error setting initial pubkey context:', error);
          });
      }
    }
  }, [assetContext?.pubkeys, selectedPubkey, app])

  // Update native gas balance (CACAO) when selectedPubkey changes
  useEffect(() => {
    if (!assetContext?.isToken || !selectedPubkey || !app?.balances) {
      return;
    }

    console.log('🔍 [Send] Looking for native gas balance for selected pubkey:', {
      address: selectedPubkey.address,
      master: selectedPubkey.master,
      nativeSymbol: assetContext.nativeSymbol,
      networkId: assetContext.networkId
    });

    // Find the native asset CAIP for this network
    // For Maya tokens, native asset is CACAO
    let nativeAssetCaip = assetContext.networkId;

    // Find the native gas balance for the selected pubkey
    const gasBalance = app.balances.find((b: any) => {
      // Must match the native asset (e.g., CACAO for Maya)
      const isNativeAsset = b.caip === nativeAssetCaip ||
                           b.networkId === nativeAssetCaip ||
                           b.symbol === assetContext.nativeSymbol;

      if (!isNativeAsset) {
        return false;
      }

      // Match by pubkey/address
      const isMatchingPubkey = b.pubkey === selectedPubkey.pubkey ||
                              b.pubkey === selectedPubkey.address ||
                              b.address === selectedPubkey.address ||
                              b.master === selectedPubkey.master ||
                              b.address === selectedPubkey.master;

      if (isMatchingPubkey) {
        console.log('✅ [Send] Found native gas balance:', {
          balance: b.balance,
          symbol: b.symbol,
          address: b.address || b.pubkey
        });
      }

      return isMatchingPubkey;
    });

    if (gasBalance && gasBalance.balance) {
      setNativeGasBalance(gasBalance.balance);
      console.log('✅ [Send] Native gas balance updated:', gasBalance.balance, assetContext.nativeSymbol);
    } else {
      console.warn('⚠️ [Send] No native gas balance found for selected pubkey');
      setNativeGasBalance('0');
    }
  }, [selectedPubkey, app?.balances, assetContext?.isToken, assetContext?.networkId, assetContext?.nativeSymbol])

  // Enrich UTXO pubkeys with address usage info (receive/change indices)
  useEffect(() => {
    const enrichPubkeys = async () => {
      if (!assetContext?.pubkeys || assetContext.pubkeys.length === 0) {
        return;
      }

      // Check if this is a UTXO network
      const networkId = assetContext.networkId || assetContext.caip || '';
      if (!isUTXONetwork(networkId)) {
        return;
      }

      console.log('🔄 [Send] Fetching UTXO address usage info for pubkeys...');

      try {
        const enrichedPubkeys = await enrichPubkeysWithUsageInfo(
          assetContext.pubkeys,
          networkId
        );

        // Update assetContext with enriched pubkeys
        if (app?.setAssetContext && enrichedPubkeys.length > 0) {
          await app.setAssetContext({
            ...assetContext,
            pubkeys: enrichedPubkeys
          });
        }
      } catch (error) {
        console.error('❌ [Send] Error enriching pubkeys:', error);
      }
    };

    enrichPubkeys();
  }, [assetContext?.symbol, assetContext?.networkId]); // Only re-run when asset changes

  // Currency conversion helpers
  const formatUsd = (value: number) => formatUsdValue(value);
  const isPriceAvailable = () => checkPriceAvailable(assetContext);
  const usdToNative = (usdAmount: string) => convertUsdToNative(usdAmount, assetContext?.priceUsd);
  const nativeToUsd = (nativeAmount: string) => convertNativeToUsd(nativeAmount, assetContext?.priceUsd);

  // Calculate fee in USD
  const updateFeeInUsd = (feeInNative: string) => {
    const networkType = assetContext?.networkId ? getNetworkType(assetContext.networkId) : 'OTHER';
    const feeUsd = calcFeeInUsd(feeInNative, assetContext?.priceUsd, networkType, assetContext?.networkId);
    setEstimatedFeeUsd(feeUsd);
  };

  // Add helper function to classify the network type
  const getNetworkType = (networkId: string): 'UTXO' | 'EVM' | 'TENDERMINT' | 'OTHER' => {
    if (UTXO_NETWORKS.some(id => networkId.startsWith(id)) || networkId.startsWith('bip122:')) {
      return 'UTXO';
    }
    if (EVM_NETWORKS.some(id => networkId.startsWith(id)) || networkId.startsWith('eip155:')) {
      return 'EVM';
    }
    if (TENDERMINT_SUPPORT.some(id => networkId.startsWith(id)) || networkId.startsWith('cosmos:')) {
      return 'TENDERMINT';
    }
    return 'OTHER';
  };

  // Get estimated transaction size for UTXO chains
  // This is a rough estimate - actual size depends on inputs/outputs
  const getEstimatedTxSize = (): number => {
    // Basic formula for UTXO transaction size:
    // - Each input: ~148 bytes (P2PKH) or ~68 bytes (P2WPKH/SegWit)
    // - Each output: ~34 bytes
    // - Base overhead: ~10 bytes

    // Conservative estimate for 3-4 inputs (better to overestimate):
    // Assuming mixed SegWit and legacy inputs for safety
    // 10 (overhead) + 100*3.5 (avg 3.5 inputs) + 34*2 (2 outputs) = ~428 bytes
    // Using 400 as a reasonable conservative estimate
    return 400;
  };

  // Helper function to resolve network ID from asset context
  const resolveNetworkId = (context: any): string | null => {
    if (!context) return null;

    let networkId = context.networkId;

    // If networkId contains wildcard, try to extract from CAIP
    if (networkId?.includes('*')) {
      // Try to get from CAIP identifier (e.g., eip155:1/slip44:60 -> eip155:1)
      if (context.caip) {
        const caipParts = context.caip.split('/');
        if (caipParts[0] && !caipParts[0].includes('*')) {
          networkId = caipParts[0];
        }
      }

      // If still has wildcard, try assetId
      if (networkId?.includes('*') && context.assetId) {
        const assetParts = context.assetId.split('/');
        if (assetParts[0] && !assetParts[0].includes('*')) {
          networkId = assetParts[0];
        }
      }
    }

    return (!networkId || networkId.includes('*')) ? null : networkId;
  };

  // Fetch fee rates from Pioneer API
  const fetchFeeRates = async () => {
    if (!assetContext) {
      setError('Asset context not available');
      return;
    }

    // Use helper to resolve network ID
    const networkId = resolveNetworkId(assetContext);

    if (!networkId) {
      setError('Cannot determine specific network chain ID');
      console.error('Invalid network ID:', networkId, 'Asset context:', assetContext);
      return;
    }

    // Store the resolved network ID for use in other components
    setResolvedNetworkId(networkId);

    try {
      if (!app?.getFees) {
        throw new Error('Pioneer SDK getFees not available');
      }

      console.log('Fetching fee rates for network:', networkId);

      // Use the new normalized getFees method from SDK
      const normalizedFees = await app.getFees(networkId);
      console.log('Normalized fees from SDK:', normalizedFees);

      // Store the complete normalized fee data
      setNormalizedFees(normalizedFees);

      // Extract the simple fee values for the UI
      const fees = {
        slow: normalizedFees.slow.value,
        average: normalizedFees.average.value,
        fastest: normalizedFees.fastest.value
      };

      console.log('Using fees from SDK:', fees);
      console.log('Fee metadata:', {
        unit: normalizedFees.slow.unit,
        networkType: normalizedFees.networkType,
        labels: {
          slow: normalizedFees.slow.label,
          average: normalizedFees.average.label,
          fastest: normalizedFees.fastest.label
        },
        estimatedTimes: {
          slow: normalizedFees.slow.estimatedTime,
          average: normalizedFees.average.estimatedTime,
          fastest: normalizedFees.fastest.estimatedTime
        }
      });

      // Store the fee options
      setFeeOptions(fees);

      // Calculate estimated fee based on network type and selected level
      const selectedFee = normalizedFees[selectedFeeLevel];

      if (normalizedFees.networkType === 'EVM') {
        // For EVM chains, multiply gas price by gas limit
        // Native ETH transfers: 21000 gas
        // ERC20 token transfers: ~65000 gas (can vary by token)
        const isToken = assetContext?.isToken || assetContext?.type === 'token';
        const gasLimit = isToken ? 65000 : 21000;
        const gasPriceGwei = parseFloat(selectedFee.value);
        const feeInGwei = gasPriceGwei * gasLimit;
        const feeInEth = feeInGwei / 1e9; // Convert Gwei to ETH
        const feeString = feeInEth.toFixed(9);

        console.log('Calculated EVM fee:', {
          isToken,
          gasPriceGwei,
          gasLimit,
          feeInGwei,
          feeInEth,
          feeString
        });

        setEstimatedFee(feeString);
        updateFeeInUsd(feeString);
      } else if (normalizedFees.networkType === 'UTXO') {
        // For UTXO chains, multiply fee rate by estimated transaction size
        const estimatedTxSize = getEstimatedTxSize();
        const feeRateSatPerByte = parseFloat(selectedFee.value);
        const feeInSatoshis = feeRateSatPerByte * estimatedTxSize;
        const feeInBTC = feeInSatoshis / 100000000; // Convert satoshis to BTC
        const feeString = feeInBTC.toFixed(8);

        console.log('Estimated UTXO fee:', {
          feeRateSatPerByte,
          estimatedTxSize,
          feeInSatoshis,
          feeInBTC,
          feeString
        });

        setEstimatedFee(feeString);
        updateFeeInUsd(feeString);
      } else {
        // For other chains (COSMOS, RIPPLE), use the fee value directly
        console.log(`Using fee directly for ${normalizedFees.networkType}:`, selectedFee.value, selectedFee.unit);
        setEstimatedFee(selectedFee.value);
        updateFeeInUsd(selectedFee.value);
      }
      
    } catch (error: any) {
      console.error('Failed to fetch fee rates:', error);
      console.error('Network ID sent to API:', networkId);
      console.error('Full asset context:', assetContext);
      
      // Extract more detailed error information
      let errorDetail = error.message || 'Unknown error';
      if (error.response?.data?.message) {
        errorDetail = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorDetail = JSON.stringify(error.response.data.error);
      }
      
      // Check for the specific server-side routing bug
      if (errorDetail.includes('missing node! for network eip155:*')) {
        errorDetail = `Server routing issue: The Pioneer API server is incorrectly converting "${networkId}" to "eip155:*". This is a known server bug that needs to be fixed in the Pioneer API backend.`;
        console.error('SERVER BUG DETECTED:', errorDetail);
      }
      
      const errorMessage = `Failed to get network fees for ${networkId}: ${errorDetail}`;
      setError(errorMessage);
      setShowErrorDialog(true);

      // Don't proceed with fake fees - show the error to the user
      // Setting to 0 prevents transaction from proceeding
      setFeeOptions({ slow: '0', average: '0', fastest: '0' });
      setEstimatedFee('0');
      setEstimatedFeeUsd('0.00');
    }
  };
  

  // Handle fee selection change
  const handleFeeSelectionChange = (feeLevel: FeeLevel) => {
    setSelectedFeeLevel(feeLevel);
    setCustomFeeOption(false);

    // Recalculate estimated fee based on the selected level
    if (normalizedFees && feeOptions[feeLevel]) {
      const selectedFee = normalizedFees[feeLevel];

      if (normalizedFees.networkType === 'UTXO') {
        // For UTXO chains, calculate estimated fee based on transaction size
        const estimatedTxSize = getEstimatedTxSize();
        const feeRateSatPerByte = parseFloat(selectedFee.value);
        const feeInSatoshis = feeRateSatPerByte * estimatedTxSize;
        const feeInBTC = feeInSatoshis / 100000000; // Convert satoshis to BTC
        const feeString = feeInBTC.toFixed(8);

        setEstimatedFee(feeString);
        updateFeeInUsd(feeString);
      } else if (normalizedFees.networkType === 'EVM') {
        // For EVM chains, calculate with gas limit
        // Native ETH transfers: 21000 gas
        // ERC20 token transfers: ~65000 gas (can vary by token)
        const isToken = assetContext?.isToken || assetContext?.type === 'token';
        const gasLimit = isToken ? 65000 : 21000;
        const gasPriceGwei = parseFloat(selectedFee.value);
        const feeInGwei = gasPriceGwei * gasLimit;
        const feeInEth = feeInGwei / 1e9; // Convert Gwei to ETH
        const feeString = feeInEth.toFixed(9);

        setEstimatedFee(feeString);
        updateFeeInUsd(feeString);
      } else {
        // For other chains (COSMOS, RIPPLE), use the fee value directly
        console.log('Using fee directly for', feeLevel, ':', selectedFee.value, selectedFee.unit);
        setEstimatedFee(selectedFee.value);
        updateFeeInUsd(selectedFee.value);
      }
    }
  };
  
  // Handle custom fee input
  const handleCustomFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and a single decimal point
    if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
      setCustomFeeAmount(value);

      if (value && normalizedFees) {
        // Calculate the actual fee based on the network type
        if (normalizedFees.networkType === 'UTXO') {
          // Custom value is fee rate in sat/byte
          const estimatedTxSize = getEstimatedTxSize();
          const feeRateSatPerByte = parseFloat(value);
          const feeInSatoshis = feeRateSatPerByte * estimatedTxSize;
          const feeInBTC = feeInSatoshis / 100000000;
          const feeString = feeInBTC.toFixed(8);

          setEstimatedFee(feeString);
          updateFeeInUsd(feeString);
        } else if (normalizedFees.networkType === 'EVM') {
          // Custom value is gas price in gwei
          // Native ETH transfers: 21000 gas
          // ERC20 token transfers: ~65000 gas (can vary by token)
          const isToken = assetContext?.isToken || assetContext?.type === 'token';
          const gasLimit = isToken ? 65000 : 21000;
          const gasPriceGwei = parseFloat(value);
          const feeInGwei = gasPriceGwei * gasLimit;
          const feeInEth = feeInGwei / 1e9;
          const feeString = feeInEth.toFixed(9);

          setEstimatedFee(feeString);
          updateFeeInUsd(feeString);
        } else {
          // For other chains (COSMOS, RIPPLE), use the fee directly
          setEstimatedFee(value);
          updateFeeInUsd(value);
        }
      }
    }
  };

  // Toggle between USD and native input
  const toggleInputMode = () => {
    // Prevent switching to USD mode when price is not available
    if (!isUsdInput && !isPriceAvailable()) {
      console.warn('Cannot switch to USD input mode: Price data is not available');
      return;
    }

    if (amount) {
      // Convert the current amount when switching modes
      if (isUsdInput) {
        // Converting from USD to native
        setAmount(usdToNative(amount));
      } else {
        // Converting from native to USD
        setAmount(nativeToUsd(amount));
      }
    }
    setIsUsdInput(!isUsdInput);
  }

  // Handle amount input change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow only numbers and a single decimal point
    if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
      setAmount(value)
      setIsMax(false)
    }
  }

  // Set max amount (full balance)
  const handleSetMax = () => {
    if (isUsdInput) {
      // If in USD mode, set max as the USD value of the balance
      setAmount(nativeToUsd(balance));
    } else {
      // In native mode, set the native balance
      setAmount(balance);
    }
    setIsMax(true);
  }

  // Handle pubkey selection change
  const handlePubkeyChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const pubkeyPath = event.target.value;

    console.log('🔄 [Send] Changing pubkey context to path:', pubkeyPath);

    // Find the pubkey that matches the selected path
    if (assetContext?.pubkeys) {
      const result = assetContext.pubkeys.find((pubkey: Pubkey) =>
        pubkey.pathMaster === pubkeyPath
      );

      if (result) {
        console.log('📍 [Send] Selected pubkey details:', {
          address: result.address,
          master: result.master,
          pubkey: result.pubkey,
          note: result.note,
          pathMaster: result.pathMaster
        });

        // Set selected pubkey FIRST - this will trigger the useEffect
        setSelectedPubkey(result as Pubkey);

        // Set pubkey context in Pioneer SDK for transactions
        if (app?.setPubkeyContext) {
          try {
            // CRITICAL: Set asset context BEFORE pubkey context
            // setAssetContext has auto-set logic that can overwrite pubkeyContext
            // So we must set asset first, then override with our desired pubkey
            if (app?.setAssetContext && assetContext) {
              console.log('🔄 [Send] Setting asset context first...');
              await app.setAssetContext(assetContext);
              console.log('✅ [Send] Asset context set');
            }

            // Now set the specific pubkey context we want (this overrides any auto-set)
            await app.setPubkeyContext(result);
            console.log('✅ [Send] Pubkey context set to desired address:', {
              address: result.address,
              note: result.note,
              addressNList: result.addressNList || result.addressNListMaster
            });

            // Force balance recalculation by updating the useEffect dependency
            // The useEffect will handle finding and setting the correct balance
            console.log('💰 [Send] Balance will be updated by useEffect');
          } catch (error) {
            console.error('❌ [Send] Error setting pubkey context:', error);
          }
        }

        console.log('✅ [Send] Pubkey change complete');
      } else {
        console.warn('⚠️ [Send] Could not find pubkey matching path:', pubkeyPath);
      }
    }
  };

  // Handle adding a new path
  const handleAddPath = async () => {
    try {
      await pathManager.addPath();

      // Refresh asset context to get the new pubkey
      if (app?.setAssetContext && assetContext) {
        console.log('🔄 [Send] Refreshing asset context after adding path...');
        await app.setAssetContext(assetContext);
        console.log('✅ [Send] Asset context refreshed with new path');
      }

      // Close dialog on success
      closeAddPathDialog();
    } catch (err: any) {
      // Error is already handled in the hook
      console.error('❌ [Send] Error adding path:', err);
    }
  };

  // Handle send transaction
  const handleSend = async () => {
    if (!amount || !recipient) {
      console.error('Missing fields')
      return
    }

    // Check if we have valid fee data before proceeding
    if (!feeOptions || (feeOptions.slow === '0' && feeOptions.average === '0' && feeOptions.fastest === '0')) {
      console.error('No valid fee data available')
      setError('Unable to proceed: Fee data is not available. Please try again or check your network connection.')
      setShowErrorDialog(true)
      return
    }

    // Also check if the selected fee is 0 (which shouldn't be allowed)
    const selectedFee = customFeeOption ? customFeeAmount : feeOptions[selectedFeeLevel]
    if (!selectedFee || parseFloat(selectedFee) === 0) {
      console.error('Invalid fee amount:', selectedFee)
      setError('Unable to proceed: Invalid fee amount. Please select a valid fee option or enter a custom fee.')
      setShowErrorDialog(true)
      return
    }

    // Show loading spinner while building transaction
    setIsBuildingTx(true)
    setLoading(true)

    try {
      // Build the transaction first
      setTransactionStep('review')
      const builtTx = await buildTransaction()

      // Then show confirmation dialog with the built transaction
      if (builtTx) {
        openConfirmation()
      }
    } catch (error) {
      console.error('Error preparing transaction:', error)
    } finally {
      setIsBuildingTx(false)
      setLoading(false)
    }
  }

  // Build transaction with optional override script type
  const buildTransactionWithScriptType = async (overrideScriptType?: string) => {
    setLoading(true)
    try {
      // Use the Pioneer SDK to build the transaction
      const caip = assetContext?.caip || assetContext?.assetId

      if (!caip) {
        throw new Error('Missing asset CAIP')
      }

      // Log the asset context to debug network ID issues
      console.log('Building transaction with asset context:', {
        caip,
        networkId: assetContext?.networkId,
        assetId: assetContext?.assetId,
        symbol: assetContext?.symbol
      })

      // Convert amount to native token if in USD mode
      const nativeAmount = isUsdInput ? usdToNative(amount) : amount;

      // Validate the amount is not NaN or empty
      if (!nativeAmount || nativeAmount === '0' || isNaN(parseFloat(nativeAmount))) {
        console.error('Invalid amount for transaction:', {
          amount,
          nativeAmount,
          isUsdInput,
          priceUsd: assetContext?.priceUsd
        });
        throw new Error('Invalid amount: Please enter a valid amount');
      }

      console.log('Transaction amount validation:', {
        originalAmount: amount,
        nativeAmount,
        isUsdInput,
        priceUsd: assetContext?.priceUsd
      });

      // Verify we have valid fee data before building the transaction
      const selectedFee = customFeeOption ? customFeeAmount : feeOptions[selectedFeeLevel];
      if (!selectedFee || parseFloat(selectedFee) === 0) {
        throw new Error('Cannot build transaction without valid fee data. Please wait for fee rates to load.');
      }

      // Map fee levels to SDK fee level values (valid range: 1-5)
      // 1 = slow/economy, 3 = average/standard, 5 = fast/priority
      const feeLevelMap = {
        slow: 1,
        average: 3,
        fastest: 5
      };

      const sendPayload: SendPayload = {
        caip,
        to: recipient,
        amount: nativeAmount,
        feeLevel: customFeeOption ? 3 : feeLevelMap[selectedFeeLevel], // Use selected or custom fee level (valid range: 1-5)
        isMax,
      }

      // Add custom fee if specified
      if (customFeeOption && customFeeAmount) {
        // @ts-ignore - Adding custom fee property
        sendPayload.customFee = customFeeAmount;
      }

      // Add memo for supported chains if provided
      if (memo && supportsMemo) {
        sendPayload.memo = memo;
      }

      // Add change script type for UTXO chains if specified
      // Use override if provided (for immediate updates), otherwise use state
      const scriptTypeToUse = overrideScriptType || changeScriptType;
      if (scriptTypeToUse) {
        sendPayload.changeScriptType = scriptTypeToUse;
        console.log('🔄 [Send] Using custom change script type:', scriptTypeToUse);
      }

      console.log('Build TX Payload:', sendPayload);
      console.log('Fee details:', {
        selectedFeeLevel,
        feeLevel: sendPayload.feeLevel,
        customFeeOption,
        customFee: sendPayload.customFee,
        feeOptions,
        normalizedFees
      });
      
      // Call the SDK's buildTx method
      let unsignedTxResult;
      try {
        unsignedTxResult = await app.buildTx(sendPayload);
        console.log('Unsigned TX Result:', unsignedTxResult);
      } catch (buildError: any) {
        console.error('Transaction build error:', buildError);
        const errorMessage = `Failed to build transaction: ${buildError.message || 'Unknown error'}`;
        setError(errorMessage);
        setShowErrorDialog(true);
        throw buildError;
      }
      
      if (!unsignedTxResult) {
        throw new Error('Failed to build transaction: No result returned');
      }
      
      // Extract fee from unsigned transaction result
      try {
        let feeValue = null;
        
        // Log the entire unsigned transaction for debugging
        console.log('Full unsigned transaction result:', JSON.stringify(unsignedTxResult, null, 2));

        // Debug fee extraction to understand object structure
        console.log('Debug fee extraction:', {
          hasTopLevelFee: !!unsignedTxResult.fee,
          topLevelFeeType: typeof unsignedTxResult.fee,
          topLevelFeeValue: unsignedTxResult.fee,
          hasSignDoc: !!unsignedTxResult.signDoc,
          hasSignDocFee: !!(unsignedTxResult.signDoc?.fee),
          signDocFeeValue: unsignedTxResult.signDoc?.fee
        });

        if (unsignedTxResult && typeof unsignedTxResult === 'object') {
          // Check if this is a UTXO transaction (Bitcoin, Litecoin, etc.)
          const caipId = assetContext?.caip || assetContext?.assetId;
          const isUtxoNetwork = UTXO_NETWORKS.includes(caipId);
          
          if (isUtxoNetwork && unsignedTxResult.inputs && unsignedTxResult.outputs) {
            // For UTXO chains, calculate fee as: total_inputs - total_outputs
            console.log('Calculating UTXO fee from inputs and outputs');
            console.log('Transaction structure:', {
              inputs: unsignedTxResult.inputs,
              outputs: unsignedTxResult.outputs
            });
            
            // Sum up all input values (amount field is in satoshis as string)
            const totalInputs = unsignedTxResult.inputs.reduce((sum: number, input: any) => {
              // The amount field is in satoshis as a string
              const value = input.amount || input.value || '0';
              const satoshis = typeof value === 'string' ? parseInt(value, 10) : value;
              console.log(`Input ${input.txid}:${input.vout} = ${satoshis} sats`);
              return sum + satoshis;
            }, 0);
            
            // Sum up all output values (amount field is in satoshis as string)
            const totalOutputs = unsignedTxResult.outputs.reduce((sum: number, output: any) => {
              // The amount field is in satoshis as a string
              const value = output.amount || output.value || '0';
              const satoshis = typeof value === 'string' ? parseInt(value, 10) : value;
              console.log(`Output to ${output.address || 'change'} = ${satoshis} sats`);
              return sum + satoshis;
            }, 0);
            
            // Fee is the difference (in satoshis)
            const feeInSatoshis = totalInputs - totalOutputs;
            
            // Convert satoshis to BTC for display
            feeValue = (feeInSatoshis / 100000000).toFixed(8);
            
            console.log('UTXO fee calculation:', {
              totalInputs,
              totalOutputs,
              feeInSatoshis,
              feeInBTC: feeValue
            });
          } else if (unsignedTxResult.fee) {
            // Direct fee field (from UTXO transactions - fee is in satoshis)
            const feeStr = typeof unsignedTxResult.fee === 'string'
              ? unsignedTxResult.fee
              : unsignedTxResult.fee.toString();

            // Check if this is a UTXO transaction (Bitcoin, etc) by checking for inputs/outputs
            if (unsignedTxResult.inputs && unsignedTxResult.outputs) {
              // Fee is in satoshis, convert to BTC
              const feeInSatoshis = parseInt(feeStr);
              feeValue = (feeInSatoshis / 100000000).toFixed(8);
              console.log('UTXO fee from direct field:', feeInSatoshis, 'sats =', feeValue, 'BTC');
            } else {
              // For other chains, use the fee as-is
              feeValue = feeStr;
            }
          } else if (unsignedTxResult.feeValue) {
            feeValue = unsignedTxResult.feeValue.toString();
          } else if (unsignedTxResult.signDoc && unsignedTxResult.signDoc.fee) {
            // THORChain/MayaChain-style transactions with signDoc structure
            const signDocFee = unsignedTxResult.signDoc.fee;
            if (signDocFee.amount && signDocFee.amount.length > 0) {
              // Fee is in the amount array - convert from base units to display units
              const feeAmount = signDocFee.amount[0].amount;
              const feeDenom = signDocFee.amount[0].denom;

              // Convert base units to display units based on denom
              if (feeDenom === 'rune') {
                // THORChain: 8 decimals
                feeValue = (parseInt(feeAmount) / 1e8).toFixed(8);
              } else if (feeDenom === 'cacao') {
                // MayaChain: 10 decimals
                feeValue = (parseInt(feeAmount) / 1e10).toFixed(10);
              } else {
                // Default: use as-is
                feeValue = feeAmount;
              }
              console.log('Extracted fee from signDoc tx:', feeValue, feeDenom);
            }
          } else if (unsignedTxResult.tx && unsignedTxResult.tx.value && unsignedTxResult.tx.value.fee) {
            // Cosmos-style transactions (including XRP wrapped in Cosmos format)
            const cosmosStyleFee = unsignedTxResult.tx.value.fee;
            if (cosmosStyleFee.amount && cosmosStyleFee.amount.length > 0) {
              // Fee is in the amount array
              feeValue = cosmosStyleFee.amount[0].amount;
              console.log('Extracted fee from Cosmos-style tx:', feeValue);
            }
          } else if (unsignedTxResult.payment && unsignedTxResult.payment.amount) {
            // XRP/Ripple transactions - use a default fee if not specified
            // XRP fees are typically 10-20 drops (0.00001-0.00002 XRP)
            // Check if there's a Fee field in the transaction first
            if (unsignedTxResult.Fee) {
              // Fee is specified in drops (1 XRP = 1,000,000 drops)
              const feeInDrops = typeof unsignedTxResult.Fee === 'string' 
                ? parseInt(unsignedTxResult.Fee) 
                : unsignedTxResult.Fee;
              feeValue = (feeInDrops / 1000000).toString();
              console.log('Extracted XRP fee from Fee field:', feeInDrops, 'drops =', feeValue, 'XRP');
            } else {
              // Use default fee if not specified
              feeValue = '0.000012'; // 12 drops in XRP
              console.log('Using default XRP fee:', feeValue, 'XRP (12 drops)');
            }
          } else if (unsignedTxResult.gasPrice && (unsignedTxResult.gas || unsignedTxResult.gasLimit)) {
            // EVM chains provide gasPrice and gas limit - calculate the fee
            // gasPrice is in hex Wei, gas/gasLimit is hex gas units
            const gasPriceStr = String(unsignedTxResult.gasPrice);
            const gasLimitStr = String(unsignedTxResult.gas || unsignedTxResult.gasLimit);
            
            const gasPriceHex = gasPriceStr.startsWith('0x') 
              ? gasPriceStr 
              : '0x' + gasPriceStr;
            const gasLimitHex = gasLimitStr.startsWith('0x')
              ? gasLimitStr
              : '0x' + gasLimitStr;
              
            const gasPrice = BigInt(gasPriceHex);
            const gasLimit = BigInt(gasLimitHex);
            const feeInWei = gasPrice * gasLimit;
            
            // Convert Wei to ETH string for display (more precise conversion)
            const feeInEth = Number(feeInWei) / 1e18;
            feeValue = feeInEth.toFixed(9);
            
            console.log('Gas calculation:', {
              gasPrice: gasPriceHex,
              gasPriceDecimal: gasPrice.toString(),
              gasPriceGwei: Number(gasPrice) / 1e9,
              gasLimit: gasLimitHex,
              gasLimitDecimal: gasLimit.toString(),
              feeInWei: feeInWei.toString(),
              feeInEth: feeValue
            });
          } else {
            // Try to find fee-related fields in any nested structure
            console.log('Could not find fee in standard locations, checking nested structures...');
            
            // Check if the result has a tx or transaction property
            const nestedTx = unsignedTxResult.tx || unsignedTxResult.transaction || unsignedTxResult.unsignedTx;
            if (nestedTx) {
              console.log('Found nested transaction:', nestedTx);
              
              // Try to extract fee from nested structure
              if (nestedTx.gasPrice && (nestedTx.gas || nestedTx.gasLimit)) {
                const gasPriceStr = String(nestedTx.gasPrice);
                const gasLimitStr = String(nestedTx.gas || nestedTx.gasLimit);
                
                const gasPriceHex = gasPriceStr.startsWith('0x') 
                  ? gasPriceStr 
                  : '0x' + gasPriceStr;
                const gasLimitHex = gasLimitStr.startsWith('0x')
                  ? gasLimitStr
                  : '0x' + gasLimitStr;
                  
                const gasPrice = BigInt(gasPriceHex);
                const gasLimit = BigInt(gasLimitHex);
                const feeInWei = gasPrice * gasLimit;
                const feeInEth = Number(feeInWei) / 1e18;
                feeValue = feeInEth.toFixed(9);
                
                console.log('Calculated fee from nested transaction:', feeValue);
              }
            }
          }
        }
        
        // The fee from the API should already be in the correct units
        console.log('Fee from transaction:', feeValue);

        // For MayaChain and ThorChain, allow empty fees (backend will apply default)
        const caipId = assetContext?.caip || assetContext?.assetId;
        const isCosmosSdkChain = caipId?.includes('mayachain') || caipId?.includes('thorchain');

        // Sanity check: if fee is null, undefined, or suspiciously high, stop
        // EXCEPT for Cosmos SDK chains where backend controller applies default fees
        if (!isCosmosSdkChain && (!feeValue || feeValue === null)) {
          throw new Error('Could not extract fee from transaction. Transaction cannot proceed without fee information.');
        }

        // If Cosmos SDK chain has no fee, set a placeholder for display
        if (isCosmosSdkChain && (!feeValue || feeValue === null)) {
          feeValue = '0'; // Backend will apply actual fee
          console.log('MayaChain/ThorChain: Using backend default fee');
        }

        // Check for suspiciously high fees (like 1 BTC)
        const feeAsNumber = parseFloat(feeValue);
        if (isNaN(feeAsNumber)) {
          throw new Error('Invalid fee value extracted from transaction.');
        }

        // For Bitcoin/UTXO chains, if fee is greater than 0.01 BTC (1,000,000 satoshis), it's likely wrong
        const isUtxoNetwork = UTXO_NETWORKS.some(id => caipId?.includes(id));
        if (isUtxoNetwork && feeAsNumber > 0.01) {
          console.error('Suspiciously high fee detected:', feeValue, 'BTC');
          throw new Error(`Fee appears incorrect: ${feeValue} BTC is unusually high. Please check fee rates and try again.`);
        }

        setEstimatedFee(feeValue);
        updateFeeInUsd(feeValue);

      } catch (feeError: any) {
        console.error('Error extracting fee from transaction:', feeError);
        const errorMessage = `Failed to calculate transaction fee: ${feeError.message}`;
        setError(errorMessage);
        setShowErrorDialog(true);
        throw feeError; // Stop the transaction if we can't get the fee
      }
      
      // Store the unsigned transaction
      const transactionState: TransactionState = {
        method: 'transfer',
        caip,
        params: sendPayload,
        unsignedTx: unsignedTxResult,
        signedTx: null,
        state: 'unsigned',
        context: assetContext,
      }
      
      setUnsignedTx(transactionState)
      
      return transactionState
    } catch (error) {
      console.error('Transaction build error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Build transaction (calls buildTransactionWithScriptType with no override)
  const buildTransaction = async () => {
    return buildTransactionWithScriptType();
  }

  // Sign transaction
  const signTransaction = async (txState: TransactionState) => {
    setLoading(true)
    try {
      const caip = assetContext?.caip || assetContext?.assetId
      
      if (!txState?.unsignedTx) {
        throw new Error('No unsigned transaction to sign')
      }
      
      console.log('Signing TX:', txState.unsignedTx)

      // Call the SDK's signTx method with TWO separate parameters (not an object)
      // See: pioneer-sdk/src/index.ts signTx(caip: string, unsignedTx: any)
      const signedTxResult = await app.signTx(
        caip,
        txState.unsignedTx
      )
      
      console.log('Signed TX Result:', signedTxResult)
      setSignedTx(signedTxResult)
      setTransactionStep('broadcast')
      
      // Play woosh sound when transaction is signed successfully
      playSound(wooshSound);
      
      return signedTxResult
    } catch (error: any) {
      console.error('Transaction signing error:', error)
      // Set error message and show error dialog
      setError(error.message || 'Failed to sign transaction')
      setShowErrorDialog(true)
      // Reset transaction step
      setTransactionStep('review')
      throw error
    } finally {
      setLoading(false)
    }
  }
  
  // Broadcast transaction
  const broadcastTransaction = async (signedTxData: any) => {
    setLoading(true)
    try {
      const caip = assetContext?.caip || assetContext?.assetId
      
      if (!signedTxData) {
        throw new Error('No signed transaction to broadcast')
      }
      
      console.log('Broadcasting TX:', signedTxData)
      
      // Call the SDK's broadcastTx method
      const broadcastResult = await app.broadcastTx(caip, signedTxData)
      
      console.log('Broadcast Result:', broadcastResult)
      
      // Extract the transaction hash from the result - handle different result formats
      let finalTxHash = '';
      
      // Check if the result is an error object
      if (broadcastResult && typeof broadcastResult === 'object' && 'error' in broadcastResult) {
        // This is an error response
        throw new Error(broadcastResult.error || 'Broadcast failed');
      } else if (typeof broadcastResult === 'string') {
        finalTxHash = broadcastResult;
      } else if (broadcastResult?.txHash) {
        finalTxHash = broadcastResult.txHash;
      } else if (broadcastResult?.txid) {
        finalTxHash = broadcastResult.txid;
      } else if (broadcastResult) {
        // Try to convert to string if it's something else
        finalTxHash = String(broadcastResult);
      }
      
      if (!finalTxHash) {
        throw new Error('No transaction hash returned from broadcast');
      }
      
      console.log('Final TX Hash:', finalTxHash);
      setTxHash(finalTxHash)
      setTxSuccess(true)
      setTransactionStep('success')
      
      return broadcastResult
    } catch (error: any) {
      console.error('Transaction broadcast error:', error)
      // Set error message and show error dialog
      setError(error.message || 'Failed to broadcast transaction')
      setShowErrorDialog(true)
      // Reset transaction step
      setTransactionStep('review')
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Confirm and execute transaction
  const confirmTransaction = async () => {
    setLoading(true)
    try {
      // Step 1: Sign the transaction
      setTransactionStep('sign')
      const signedTxData = await signTransaction(unsignedTx)

      // Step 2: Broadcast the transaction
      await broadcastTransaction(signedTxData)

      console.log('Transaction sent successfully')
    } catch (error) {
      console.error('Transaction error:', error)
      // Error is already handled in the respective functions
    } finally {
      setLoading(false)
    }
  }

  // View change address on device
  const handleViewChangeOnDevice = async (output: any) => {
    if (!app?.keepKeySdk) {
      console.error('KeepKey SDK not available')
      return
    }

    try {
      setLoading(true)
      console.log('👁️ [Send] Viewing change address on device...')
      console.log('🔑 [Send] Change output:', output)

      if (!output.addressNList && !output.address_n) {
        throw new Error('No address path available')
      }

      const addressNList = output.addressNList || output.address_n
      const scriptType = output.scriptType || 'p2wpkh'

      console.log('🔐 [Send] Network ID:', assetContext.networkId)
      console.log('📝 [Send] Script Type:', scriptType)
      console.log('🛣️ [Send] Address Path:', addressNList)

      // Call KeepKey SDK directly with the exact path from the change output
      // Don't use getAndVerifyAddress because it modifies the path indices
      const addressInfo: any = {
        address_n: addressNList,
        show_display: true,
        script_type: scriptType,
        coin: 'Bitcoin' // For Bitcoin mainnet
      }

      console.log('🔑 [Send] Calling utxoGetAddress with:', addressInfo)

      const { address: deviceAddress } = await app.keepKeySdk.address.utxoGetAddress(addressInfo)

      console.log('✅ [Send] Change address displayed on device:', deviceAddress)
    } catch (error: any) {
      console.error('❌ [Send] Error displaying address on device:', error)
      setError(error.message || 'Failed to display address on device')
      setShowErrorDialog(true)
    } finally {
      setLoading(false)
    }
  }

  // Handle change address type update
  const handleChangeAddressUpdate = async (outputIndex: number, newScriptType: string) => {
    console.log('🔄 [Send] Changing address type for output', outputIndex, 'to', newScriptType)

    try {
      setLoading(true)

      // Update the change script type state
      setChangeScriptType(newScriptType)
      console.log('📝 [Send] Set change script type to:', newScriptType)

      // Rebuild the transaction with the new script type
      // We need to pass the newScriptType directly since state updates are async
      console.log('🔨 [Send] Rebuilding transaction with new change address type...')
      const rebuiltTx = await buildTransactionWithScriptType(newScriptType)

      if (rebuiltTx) {
        console.log('✅ [Send] Transaction rebuilt successfully with new change address type')
        setUnsignedTx(rebuiltTx)
      } else {
        throw new Error('Failed to rebuild transaction')
      }
    } catch (error: any) {
      console.error('❌ [Send] Error changing address type:', error)
      setError(error.message || 'Failed to change address type')
      setShowErrorDialog(true)
      // Reset to previous state on error
      setChangeScriptType(undefined)
    } finally {
      setLoading(false)
    }
  }

  // Format transaction details for display
  const formatTransactionDetails = (tx: any): React.ReactNode => {
    const networkType = assetContext?.networkId ? getNetworkType(assetContext.networkId) : 'OTHER';
    return formatTxDetails(tx, networkType as NetworkType);
  };

  // Function to open raw transaction dialog
  const openRawTxDialog = () => {
    if (unsignedTx?.unsignedTx) {
      const formattedJson = JSON.stringify(unsignedTx.unsignedTx, null, 2);
      setRawTxJson(formattedJson);
      setEditedRawTxJson(formattedJson);
      setShowRawTxDialog(true);
    }
  };

  // Function to handle editing of raw transaction JSON
  const handleRawTxJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedRawTxJson(e.target.value);
  };

  // Function to apply edited JSON to the transaction
  const applyEditedJson = () => {
    try {
      const parsedJson = JSON.parse(editedRawTxJson);
      // Create a new transaction state with the edited unsigned transaction
      const updatedTxState = {
        ...unsignedTx,
        unsignedTx: parsedJson
      };
      setUnsignedTx(updatedTxState);
      setShowRawTxDialog(false);
      // Show a success message or toast here
    } catch (error) {
      console.error('Invalid JSON format:', error);
      // Show an error message or toast here
    }
  };

  // Function to close the dialog without applying changes
  const closeRawTxDialog = () => {
    setShowRawTxDialog(false);
  };

  // Function to handle viewing transaction on explorer
  const viewOnExplorer = () => {
    if (!txHash) {
      console.error('No transaction hash available');
      return;
    }
    
    console.log('Viewing transaction on explorer:', {
      txHash,
      networkId: assetContext?.networkId,
      explorerTxLink: assetContext?.explorerTxLink,
      caip: assetContext?.caip,
      symbol: assetContext?.symbol,
      assetContext
    });
    
    let explorerUrl;
    
    // First try to use the explorer link from asset context
    if (assetContext?.explorerTxLink) {
      // Check if the URL already ends with a slash
      const baseUrl = assetContext.explorerTxLink.endsWith('/') 
        ? assetContext.explorerTxLink
        : `${assetContext.explorerTxLink}/`;
      
      explorerUrl = `${baseUrl}${txHash}`;
      console.log('Using explorer from assetContext.explorerTxLink:', explorerUrl);
    } 
    // Fallback for different network types
    else if (assetContext?.networkId) {
      const networkId = assetContext.networkId;
      const networkType = getNetworkType(networkId);
      
      console.log('Determining explorer from networkId:', {
        networkId,
        networkType,
        isEVM: networkId.startsWith('eip155:'),
        isCosmos: networkId.startsWith('cosmos:'),
        isUTXO: networkId.startsWith('bip122:')
      });
      
      switch (networkType) {
        case 'UTXO': {
          if (networkId.includes('bip122:000000000019d6689c085ae165831e93')) {
            explorerUrl = `https://blockstream.info/tx/${txHash}`;
          } else if (networkId.includes('bip122:12a765e31ffd4059bada1e25190f6e98')) {
            explorerUrl = `https://blockchair.com/litecoin/transaction/${txHash}`;
          } else if (networkId.includes('bip122:000000000933ea01ad0ee984209779ba')) {
            explorerUrl = `https://blockchair.com/dogecoin/transaction/${txHash}`;
          } else if (networkId.includes('bip122:000000000000000000651ef99cb9fcbe')) {
            explorerUrl = `https://blockchair.com/bitcoin-cash/transaction/${txHash}`;
          } else {
            console.error(`Unsupported UTXO network: ${networkId}`);
            alert(`Error: No explorer configured for UTXO network: ${networkId}`);
            return;
          }
          break;
        }
        
        case 'EVM': {
          // Parse the chain ID from the network ID (e.g., "eip155:137" -> 137)
          const chainId = networkId.split(':')[1];
          
          const evmExplorers: Record<string, string> = {
            '1': 'https://etherscan.io/tx/',
            '56': 'https://bscscan.com/tx/',
            '137': 'https://polygonscan.com/tx/',
            '43114': 'https://snowtrace.io/tx/',
            '8453': 'https://basescan.org/tx/',
            '10': 'https://optimistic.etherscan.io/tx/',
            '42161': 'https://arbiscan.io/tx/',
            '250': 'https://ftmscan.com/tx/',
            '25': 'https://cronoscan.com/tx/',
            '100': 'https://gnosisscan.io/tx/',
            '1284': 'https://moonscan.io/tx/',
            '1285': 'https://moonriver.moonscan.io/tx/',
            '42220': 'https://celoscan.io/tx/',
            '1313161554': 'https://explorer.aurora.dev/tx/',
            '1666600000': 'https://explorer.harmony.one/tx/',
            '9001': 'https://www.mintscan.io/evmos/tx/',
          };
          
          if (evmExplorers[chainId]) {
            explorerUrl = `${evmExplorers[chainId]}${txHash}`;
          } else {
            console.error(`Unsupported EVM chain: ${networkId} (chainId: ${chainId})`);
            alert(`Error: No explorer configured for EVM chain: ${networkId}. Please contact support to add explorer for chain ID ${chainId}.`);
            return;
          }
          break;
        }
        
        case 'TENDERMINT': {
          if (networkId.includes('cosmos:cosmoshub')) {
            explorerUrl = `https://www.mintscan.io/cosmos/tx/${txHash}`;
          } else if (networkId.includes('cosmos:osmosis')) {
            explorerUrl = `https://www.mintscan.io/osmosis/tx/${txHash}`;
          } else if (networkId.includes('cosmos:thorchain')) {
            explorerUrl = `https://viewblock.io/thorchain/tx/${txHash}`;
          } else if (networkId.includes('cosmos:mayachain')) {
            explorerUrl = `https://www.mintscan.io/mayachain/tx/${txHash}`;
          } else if (networkId.includes('cosmos:kaiyo-1')) {
            explorerUrl = `https://www.mintscan.io/kujira/tx/${txHash}`;
          } else {
            const chainName = networkId.split(':')[1].split('/')[0];
            console.warn(`Using generic Mintscan for Cosmos chain: ${chainName}`);
            explorerUrl = `https://www.mintscan.io/${chainName}/tx/${txHash}`;
          }
          break;
        }
        
        case 'OTHER': {
          if (networkId.includes('ripple')) {
            explorerUrl = `https://xrpscan.com/tx/${txHash}`;
          } else {
            console.error(`Unsupported network type for networkId: ${networkId}`);
            alert(`Error: No explorer configured for network: ${networkId}. Please contact support.`);
            return;
          }
          break;
        }
        
        default:
          console.error(`Unknown network type: ${networkType} for networkId: ${networkId}`);
          alert(`Error: Unable to determine explorer for network: ${networkId}. Please contact support.`);
          return;
      }
    } else {
      // No network information available
      console.error('No network information available in assetContext');
      alert('Error: Cannot determine blockchain explorer - no network information available. Please contact support.');
      return;
    }
    
    // Open the explorer in a new tab
    if (explorerUrl) {
      console.log('Opening explorer URL:', explorerUrl);
      window.open(explorerUrl, '_blank');
    }
  }
  
  // Reset the form after completing a transaction
  const resetForm = () => {
    setAmount('')
    setRecipient('')
    setMemo('')
    setTxHash('')
    setTxSuccess(false)
    setUnsignedTx(null)
    setSignedTx(null)
    setTransactionStep('review')
    setShowConfirmation(false)
  }

  // Close error dialog
  const closeErrorDialog = () => {
    setShowErrorDialog(false)
    setError(null)
  }

  if (!assetContext) {
    return (
      <Box p={6}>
        <Stack gap={4}>
          <Skeleton height="60px" width="100%" />
          <Skeleton height="40px" width="70%" />
          <Skeleton height="80px" width="100%" />
          <Skeleton height="40px" width="90%" />
          <Skeleton height="50px" width="100%" />
          <Text color="gray.400" textAlign="center" mt={2}>
            Loading asset information...
          </Text>
        </Stack>
      </Box>
    )
  }

  const networkColor = assetContext.color || '#3182CE'
  
  // Network supports memo
  const supportsMemo = TENDERMINT_SUPPORT.includes(assetContext.assetId) || OTHER_SUPPORT.includes(assetContext.assetId);

  // Render confirmation overlay if needed
  if (showConfirmation) {
    // Transaction success screen
    if (transactionStep === 'success' && txSuccess) {
      return (
        <Box height="100vh" bg={theme.bg}>
          {/* Show confetti animation */}
          <Confetti 
            width={typeof window !== 'undefined' ? window.innerWidth : 375}
            height={typeof window !== 'undefined' ? window.innerHeight : 600}
            recycle={false}
            numberOfPieces={300}
            gravity={0.2}
            colors={[assetColor, '#FFFFFF', `${assetColor}DD`, `${assetColor}44`]}
          />
          
          <Box 
            bg={theme.cardBg}
            borderColor={theme.border}
            borderWidth="1px"
            borderRadius="md"
            width="100%"
            height="100%"
            display="flex"
            flexDirection="column"
            overflow="hidden"
          >
            {/* Header */}
            <Box 
              borderBottom="1px" 
              borderColor={theme.border}
              p={5}
              bg={theme.cardBg}
            >
              <Flex justify="space-between" align="center">
                <Text fontSize="lg" fontWeight="bold" color={assetColor}>
                  Transaction Complete
                </Text>
                <IconButton
                  aria-label="Close"
                  onClick={resetForm}
                  size="sm"
                  variant="ghost"
                  color={assetColor}
                >
                  <FaTimes />
                </IconButton>
              </Flex>
            </Box>
            
            {/* Main Content */}
            <Box 
              flex="1" 
              p={5} 
              overflowY="auto"
            >
              <Stack gap={6} align="center">
                {/* Success Icon */}
                <Box 
                  borderRadius="full" 
                  bg="green.500" 
                  color="white" 
                  width="90px" 
                  height="90px" 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center"
                  fontSize="4xl"
                  mt={3}
                  boxShadow="0px 0px 20px rgba(56, 178, 72, 0.5)"
                >
                  <FaCheck />
                </Box>
                
                <Text fontSize="2xl" fontWeight="bold" color="white" textAlign="center">
                  Transaction Sent Successfully!
                </Text>
                
                {/* Asset Icon and Info */}
                <Box 
                  borderRadius="full" 
                  overflow="hidden" 
                  boxSize="60px"
                  bg={theme.cardBg}
                  boxShadow="lg"
                  p={2}
                  borderWidth="1px"
                  borderColor={assetContext.color || theme.border}
                >
                  <Image 
                    src={assetContext.icon}
                    alt={`${assetContext.name} Icon`}
                    boxSize="100%"
                    objectFit="contain"
                  />
                </Box>
                
                <Box width="100%" textAlign="center">
                  <Text color="gray.500" fontSize="sm">Amount Sent</Text>
                  <Text fontSize="2xl" fontWeight="bold" color="white">
                    {isUsdInput ? usdToNative(amount) : amount} {assetContext.symbol}
                  </Text>
                  <Text color="gray.500" fontSize="md" mt={1}>
                    ≈ {formatUsd(parseFloat(isUsdInput ? usdToNative(amount) : amount) * (assetContext.priceUsd || 0))}
                  </Text>
                </Box>
                
                <Box as="hr" borderColor="gray.700" opacity={0.2} my={2} width="100%" />
                
                <Box width="100%">
                  <Text color="gray.500" fontSize="sm" mb={2}>Transaction Hash</Text>
                  <Box
                    p={3}
                    bg={theme.bg}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={theme.border}
                  >
                    <Flex align="center">
                      <Text fontSize="sm" fontFamily="mono" color="white" wordBreak="break-all" flex="1">
                        {txHash ? txHash : 'Transaction hash pending...'}
                      </Text>
                      <IconButton
                        aria-label="Copy to clipboard"
                        onClick={copyToClipboard}
                        size="sm"
                        variant="ghost"
                        color={hasCopied ? "green.400" : "gray.400"}
                        ml={1}
                        disabled={!txHash}
                      >
                        {hasCopied ? <FaCheck /> : <FaCopy />}
                      </IconButton>
                    </Flex>
                  </Box>
                  {txHash && (
                    <Text fontSize="xs" color="gray.500" mt={1} textAlign="right">
                      <Box 
                        as="span" 
                        cursor="pointer" 
                        _hover={{ color: assetColorHover }}
                        onClick={viewOnExplorer}
                        display="inline-flex"
                        alignItems="center"
                      >
                        View on Explorer <FaExternalLinkAlt size="0.7em" style={{ marginLeft: '4px' }} />
                      </Box>
                    </Text>
                  )}
                </Box>
              </Stack>
            </Box>
            
            {/* Footer with Action Buttons */}
            <Box 
              borderTop="1px" 
              borderColor={theme.border}
              p={5}
            >
              <Stack gap={4}>
                <Button
                  width="100%"
                  bg={assetColor}
                  color="black"
                  _hover={{
                    bg: assetColorHover,
                  }}
                  onClick={viewOnExplorer}
                  height="56px"
                >
                  <Flex gap={3} align="center">
                    <FaExternalLinkAlt />
                    <Text>View on Explorer</Text>
                  </Flex>
                </Button>
                
                <Button
                  width="100%"
                  variant="outline"
                  color={assetColor}
                  borderColor={theme.border}
                  _hover={{
                    bg: assetColorLight,
                    borderColor: assetColor,
                  }}
                  onClick={resetForm}
                  height="56px"
                >
                  Return to Dashboard
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      );
    }
    
    // Transaction in progress - use ReviewTransaction component
    return (
      <ReviewTransaction
        transactionStep={transactionStep}
        loading={loading}
        unsignedTx={unsignedTx}
        assetContext={assetContext}
        assetColor={assetColor}
        assetColorLight={assetColorLight}
        assetColorHover={assetColorHover}
        amount={amount}
        recipient={recipient}
        memo={memo}
        estimatedFee={estimatedFee}
        estimatedFeeUsd={estimatedFeeUsd}
        balance={balance}
        isMax={isMax}
        isUsdInput={isUsdInput}
        showTxDetails={showTxDetails}
        showRawTxDialog={showRawTxDialog}
        editedRawTxJson={editedRawTxJson}
        theme={theme}
        closeConfirmation={closeConfirmation}
        confirmTransaction={confirmTransaction}
        setShowTxDetails={setShowTxDetails}
        openRawTxDialog={openRawTxDialog}
        closeRawTxDialog={closeRawTxDialog}
        handleRawTxJsonChange={handleRawTxJsonChange}
        applyEditedJson={applyEditedJson}
        formatTransactionDetails={formatTransactionDetails}
        usdToNative={usdToNative}
        nativeToUsd={nativeToUsd}
        formatUsd={formatUsd}
        getNetworkType={getNetworkType}
        onViewChangeOnDevice={handleViewChangeOnDevice}
        onChangeAddressUpdate={handleChangeAddressUpdate}
      />
    );
  }

  // Normal send form
  return (
    <Box 
      width="100%" 
      maxWidth="600px"
      mx="auto"
      height="100vh"
      position="relative"
      pb={8} // Add bottom padding to ensure content doesn't get cut off
      overflow="hidden"
      display="flex"
      flexDirection="column"
      sx={{
        '&::-webkit-scrollbar': {
          width: '0px',
          background: 'transparent',
        },
        '& *::-webkit-scrollbar': {
          width: '0px',
          background: 'transparent',
        },
      }}
    >
      {/* Transaction Building Overlay */}
      {isBuildingTx && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="rgba(0, 0, 0, 0.85)"
          zIndex={1000}
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          backdropFilter="blur(2px)"
        >
          <KeepKeyUiGlyph
            boxSize="80px"
            color={assetColor}
            animation={`${scale} 2s ease-in-out infinite`}
            mb={6}
          />
          <Text color={assetColor} fontSize="xl" fontWeight="bold" mb={2}>
            Building Transaction...
          </Text>
          <Text color="gray.400" fontSize="md" textAlign="center" maxWidth="400px">
            Please wait while we prepare your transaction details
          </Text>
        </Box>
      )}
      
      {/* Error Dialog */}
      {showErrorDialog && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="rgba(0, 0, 0, 0.8)"
          zIndex={2000}
          display="flex"
          justifyContent="center"
          alignItems="center"
          p={4}
        >
          <Box
            bg={theme.cardBg}
            borderRadius="md"
            borderWidth="1px"
            borderColor="red.500"
            width="90%"
            maxWidth="600px"
            overflow="hidden"
            boxShadow="0px 4px 20px rgba(0, 0, 0, 0.5)"
          >
            <Box
              bg="red.500"
              py={4}
              px={6}
            >
              <Flex justify="space-between" align="center">
                <Flex align="center">
                  <Box fontSize="24px" mr={3}>
                    <FaTimes />
                  </Box>
                  <Text fontSize="lg" fontWeight="bold" color="white">
                    Transaction Error
                  </Text>
                </Flex>
                <IconButton
                  aria-label="Close"
                  onClick={closeErrorDialog}
                  size="sm"
                  variant="ghost"
                  color="white"
                  _hover={{ bg: 'rgba(255,255,255,0.2)' }}
                >
                  <FaTimes />
                </IconButton>
              </Flex>
            </Box>
            
            <Box p={5}>
              <Stack gap={4}>
                <Box>
                  <Text color="white" fontWeight="bold" mb={2}>
                    What went wrong:
                  </Text>
                  <Box 
                    p={3} 
                    bg="rgba(255,0,0,0.1)" 
                    borderRadius="md"
                    borderLeft="3px solid"
                    borderLeftColor="red.500"
                  >
                    <Text color="white" fontSize="md">
                      {error || 'An unexpected error occurred'}
                    </Text>
                  </Box>
                </Box>
                
                <Box>
                  <Text color="white" fontWeight="bold" mb={2}>
                    What you can do:
                  </Text>
                  <Stack gap={2} fontSize="sm" color="gray.300">
                    {error?.includes('fee') && (
                      <>
                        <Text>• Check your network connection and try again</Text>
                        <Text>• The Pioneer API may be temporarily unavailable</Text>
                        <Text>• Try selecting a different fee level</Text>
                      </>
                    )}
                    {error?.includes('sign') && (
                      <>
                        <Text>• Make sure your KeepKey is connected and unlocked</Text>
                        <Text>• Check the transaction details on your device screen</Text>
                        <Text>• Hold the button to confirm or click to reject</Text>
                      </>
                    )}
                    {error?.includes('broadcast') && (
                      <>
                        <Text>• The network may be congested - try again in a moment</Text>
                        <Text>• Check if you have sufficient balance for the transaction</Text>
                        <Text>• Verify the recipient address is valid</Text>
                      </>
                    )}
                    {!error?.includes('fee') && !error?.includes('sign') && !error?.includes('broadcast') && (
                      <>
                        <Text>• Check your KeepKey connection</Text>
                        <Text>• Ensure you have sufficient balance</Text>
                        <Text>• Try refreshing the page and attempting again</Text>
                      </>
                    )}
                  </Stack>
                </Box>
                
                {/* Technical details collapsible */}
                <Box>
                  <Text 
                    color="gray.400" 
                    fontSize="xs" 
                    cursor="pointer"
                    _hover={{ color: 'gray.300' }}
                    onClick={() => console.error('Full error:', error)}
                  >
                    Technical details (click to log to console)
                  </Text>
                </Box>
                
                <Button
                  width="100%"
                  bg={assetColor}
                  color="black"
                  _hover={{
                    bg: assetColorHover,
                  }}
                  onClick={closeErrorDialog}
                  height="50px"
                  fontSize="md"
                  fontWeight="bold"
                >
                  Try Again
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      )}
    
      <Box 
        borderBottom="1px" 
        borderColor={theme.border}
        p={4}
        bg={theme.cardBg}
        position="sticky"
        top={0}
        zIndex={10}
      >
        <Flex justify="space-between" align="center">
          <Button
            size="sm"
            variant="ghost"
            color={assetColor}
            onClick={onBackClick}
            _hover={{ color: assetColorHover }}
          >
            <Flex align="center" gap={2}>
              <Text>Back</Text>
            </Flex>
          </Button>
          <Text color={assetColor} fontWeight="bold">
            Send {assetContext?.name || 'Asset'}
          </Text>
          <Box w="20px"></Box> {/* Spacer for alignment */}
        </Flex>
      </Box>
      
      {/* Main Content */}
      <Box 
        p={5} 
        flex="1" 
        overflowY="auto"
        sx={{
          '&::-webkit-scrollbar': {
            width: '0px',
            background: 'transparent',
          },
        }}
      >
        <Stack gap={6} align="center">
          {/* Asset Header Card - Combined Asset Info + Address Selector */}
          <AssetHeaderCard
            assetContext={assetContext}
            balance={balance}
            totalBalanceUsd={totalBalanceUsd}
            selectedPubkey={selectedPubkey}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
            onPubkeyChange={handlePubkeyChange}
            onAddPathClick={openAddPathDialog}
            assetColor={assetColor}
            assetColorLight={assetColorLight}
            formatUsd={formatUsd}
            theme={theme}
          />

          {/* Amount - Enhanced Dual Input Mode */}
          <Box 
            width="100%" 
            bg={theme.cardBg} 
            borderRadius={theme.borderRadius} 
            p={theme.formPadding}
            borderWidth="1px"
            borderColor={theme.border}
          >
            <Stack gap={3}>
              <Flex justify="space-between" align="center">
                <Text color="white" fontWeight="medium">Amount</Text>
                <Button
                  size="sm"
                  bg={theme.cardBg}
                  color={assetColor}
                  borderColor={theme.border}
                  borderWidth="1px"
                  height="30px"
                  px={3}
                  _hover={{
                    bg: assetColorLight,
                    borderColor: assetColor,
                  }}
                  onClick={handleSetMax}
                >
                  MAX
                </Button>
              </Flex>
              
              {/* Active Input (Larger) */}
              <Box 
                onClick={() => !isUsdInput && toggleInputMode()}
                cursor={!isUsdInput ? "pointer" : "default"}
                transition="all 0.2s"
              >
                <Flex 
                  position="relative" 
                  align="center"
                  opacity={isUsdInput ? 1 : 0.6}
                  transform={isUsdInput ? "scale(1)" : "scale(0.95)"}
                  transition="all 0.2s"
                >
                  <Box position="absolute" left="12px" zIndex="1">
                    <Text color={isUsdInput ? assetColor : "gray.500"} fontWeight="bold" fontSize={isUsdInput ? "lg" : "md"}>$</Text>
                  </Box>
                  <Input
                    value={isUsdInput ? amount : nativeToUsd(amount)}
                    onChange={isUsdInput ? handleAmountChange : undefined}
                    placeholder="0.00"
                    color={isUsdInput ? "white" : "gray.400"}
                    borderColor={isUsdInput ? assetColor : theme.border}
                    borderWidth={isUsdInput ? "2px" : "1px"}
                    bg={isUsdInput ? theme.cardBg : "rgba(255,255,255,0.02)"}
                    _hover={{ borderColor: isUsdInput ? assetColorHover : theme.border }}
                    _focus={{ borderColor: isUsdInput ? assetColor : theme.border }}
                    p={3}
                    pl="35px"
                    pr="60px"
                    height={isUsdInput ? "56px" : "48px"}
                    fontSize={isUsdInput ? "xl" : "lg"}
                    fontWeight={isUsdInput ? "bold" : "medium"}
                    readOnly={!isUsdInput}
                    cursor={!isUsdInput ? "pointer" : "text"}
                  />
                  <Box position="absolute" right="12px" zIndex="1">
                    <Text color={isUsdInput ? "gray.400" : "gray.500"} fontSize={isUsdInput ? "md" : "sm"} fontWeight="medium">USD</Text>
                  </Box>
                </Flex>
              </Box>

              {/* Divider with Switch Icon */}
              <Flex align="center" justify="center" position="relative" my={1}>
                <Box position="absolute" width="100%" height="1px" bg={theme.border} />
                <Box 
                  position="relative"
                  bg={theme.cardBg}
                  borderRadius="full"
                  border="1px solid"
                  borderColor={theme.border}
                  p={2}
                  cursor="pointer"
                  onClick={toggleInputMode}
                  _hover={{ 
                    borderColor: assetColor,
                    bg: assetColorLight,
                    transform: "rotate(180deg)"
                  }}
                  transition="all 0.3s"
                  zIndex={1}
                >
                  <Text fontSize="sm" color={assetColor}>⇅</Text>
                </Box>
              </Flex>

              {/* Secondary Input (Smaller) */}
              <Box 
                onClick={() => isUsdInput && toggleInputMode()}
                cursor={isUsdInput ? "pointer" : "default"}
                transition="all 0.2s"
              >
                <Flex 
                  position="relative" 
                  align="center"
                  opacity={!isUsdInput ? 1 : 0.6}
                  transform={!isUsdInput ? "scale(1)" : "scale(0.95)"}
                  transition="all 0.2s"
                >
                  <Input
                    value={!isUsdInput ? amount : usdToNative(amount)}
                    onChange={!isUsdInput ? handleAmountChange : undefined}
                    placeholder="0.00000000"
                    color={!isUsdInput ? "white" : "gray.400"}
                    borderColor={!isUsdInput ? assetColor : theme.border}
                    borderWidth={!isUsdInput ? "2px" : "1px"}
                    bg={!isUsdInput ? theme.cardBg : "rgba(255,255,255,0.02)"}
                    _hover={{ borderColor: !isUsdInput ? assetColorHover : theme.border }}
                    _focus={{ borderColor: !isUsdInput ? assetColor : theme.border }}
                    p={3}
                    pl="12px"
                    pr="80px"
                    height={!isUsdInput ? "56px" : "48px"}
                    fontSize={!isUsdInput ? "xl" : "lg"}
                    fontWeight={!isUsdInput ? "bold" : "medium"}
                    readOnly={isUsdInput}
                    cursor={isUsdInput ? "pointer" : "text"}
                  />
                  <Box position="absolute" right="12px" zIndex="1">
                    <Text color={!isUsdInput ? assetColor : "gray.500"} fontSize={!isUsdInput ? "md" : "sm"} fontWeight="bold">{assetContext.symbol}</Text>
                  </Box>
                </Flex>
              </Box>

              {/* Helper text */}
              <Text 
                fontSize="xs" 
                color="gray.500" 
                textAlign="center"
                fontStyle="italic"
              >
                Click on either field to switch input mode
              </Text>
            </Stack>
          </Box>

          {/* Gas Balance Display for Tokens */}
          {assetContext.isToken && (
            <Box
              width="100%"
              bg={theme.cardBg}
              borderRadius={theme.borderRadius}
              p={theme.formPadding}
              borderWidth="2px"
              borderColor={nativeGasBalance && parseFloat(nativeGasBalance) === 0 ? "red.500" : theme.border}
            >
              <Stack gap={2}>
                <Text color="white" fontWeight="medium" fontSize="sm">Gas Balance Required</Text>
                <Flex justify="space-between" align="center">
                  <Text color="gray.400" fontSize="sm">Available Gas</Text>
                  <Stack gap={0} align="flex-end">
                    <Text
                      color={nativeGasBalance && parseFloat(nativeGasBalance) === 0 ? "red.400" : "white"}
                      fontWeight="bold"
                      fontSize="md"
                    >
                      {nativeGasBalance ? parseFloat(nativeGasBalance).toFixed(6) : '0'} {assetContext.nativeSymbol || 'GAS'}
                    </Text>
                    {nativeGasBalance && parseFloat(nativeGasBalance) === 0 && (
                      <Text color="red.400" fontSize="xs" fontWeight="medium">
                        ⚠️ No gas available - transfer will fail
                      </Text>
                    )}
                  </Stack>
                </Flex>
                {nativeGasBalance && parseFloat(nativeGasBalance) === 0 && (
                  <Box
                    bg="red.900"
                    p={2}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="red.500"
                  >
                    <Text color="red.200" fontSize="xs">
                      You need {assetContext.nativeSymbol || 'GAS'} to send {assetContext.symbol} tokens. Please add gas to your wallet first.
                    </Text>
                  </Box>
                )}
              </Stack>
            </Box>
          )}

          {/* Recipient */}
          <Box 
            width="100%" 
            bg={theme.cardBg} 
            borderRadius={theme.borderRadius} 
            p={theme.formPadding}
            borderWidth="1px"
            borderColor={theme.border}
          >
            <Stack gap={3}>
              <Text color="white" fontWeight="medium">Recipient</Text>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={`${assetContext.symbol} Address`}
                color="white"
                borderColor={theme.border}
                _hover={{ borderColor: assetColorHover }}
                _focus={{ borderColor: assetColor }}
                p={3}
                height="50px"
                fontSize="md"
              />
            </Stack>
          </Box>
          
          {/* Memo/Tag (only for supported networks) */}
          {supportsMemo && (
            <Box 
              width="100%" 
              bg={theme.cardBg} 
              borderRadius={theme.borderRadius} 
              p={theme.formPadding}
              borderWidth="1px"
              borderColor={theme.border}
            >
              <Stack gap={3}>
                <Text color="white" fontWeight="medium">
                  {assetContext.networkId?.includes('cosmos') ? 'Memo' : 'Tag'} (Optional)
                </Text>
                <Input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder={assetContext.networkId?.includes('cosmos') ? 'Memo' : 'Destination Tag'}
                  color="white"
                  borderColor={theme.border}
                  _hover={{ borderColor: assetColorHover }}
                  _focus={{ borderColor: assetColor }}
                  p={3}
                  height="50px"
                  fontSize="md"
                />
              </Stack>
            </Box>
          )}
          
          {/* Fee Selection - Now using reusable component - Hide for XRP */}
          {!assetContext?.caip?.includes('ripple') && !assetContext?.networkId?.includes('ripple') && (
            <>
              <Box 
                width="100%" 
                bg={assetColorLight} 
                borderRadius={theme.borderRadius} 
                p={theme.formPadding}
                borderWidth="1px"
                borderColor={`${assetColor}33`}
              >
                <FeeSelection
                  networkId={resolvedNetworkId || assetContext?.networkId || ''}
                  assetId={assetContext?.assetId}
                  feeOptions={feeOptions}
                  feeRates={normalizedFees ? { data: { normalized: normalizedFees } } : null}
                  selectedFeeLevel={selectedFeeLevel}
                  onFeeSelectionChange={handleFeeSelectionChange}
                  customFeeOption={customFeeOption}
                  onCustomFeeToggle={() => {
                    setCustomFeeOption(!customFeeOption);
                    if (!customFeeOption) {
                      setSelectedFeeLevel('average');
                    }
                  }}
                  customFeeAmount={customFeeAmount}
                  onCustomFeeChange={setCustomFeeAmount}
                  theme={{
                    gold: assetColor,
                    goldHover: assetColorHover,
                    border: theme.border
                  }}
                />
              </Box>
              
              {/* Fee Estimate */}
              <Box 
                width="100%" 
                bg={assetColorLight} 
                borderRadius={theme.borderRadius} 
                p={theme.formPadding}
                borderWidth="1px"
                borderColor={`${assetColor}33`}
              >
                <Flex justify="space-between" align="center">
                  <Text color="gray.400">Estimated Fee</Text>
                  <Stack gap={0} align="flex-end">
                    <Text color={assetColor} fontWeight="medium">
                      {estimatedFee} {assetContext.symbol}
                    </Text>
                    <Text color="gray.500" fontSize="xs">
                      ≈ ${estimatedFeeUsd} USD
                    </Text>
                  </Stack>
                </Flex>
              </Box>
            </>
          )}
          
          {/* Send Button */}
          <Button
            mt={4}
            width="100%"
            bg={assetColor}
            color="black"
            _hover={{
              bg: assetColorHover,
            }}
            onClick={handleSend}
            disabled={!amount || !recipient || !feeOptions || (feeOptions.slow === '0' && feeOptions.average === '0' && feeOptions.fastest === '0')}
            height="56px"
            fontSize="lg"
            boxShadow={`0px 4px 12px ${assetColor}4D`}
          >
            <Flex gap={3} align="center" justify="center">
              <FaPaperPlane />
              <Text>
                {!feeOptions || (feeOptions.slow === '0' && feeOptions.average === '0' && feeOptions.fastest === '0')
                  ? 'Waiting for fee data...'
                  : `Send ${assetContext.symbol}`}
              </Text>
            </Flex>
          </Button>
        </Stack>
      </Box>

      {/* Add Path Dialog */}
      <DialogRoot open={showAddPathDialog} onOpenChange={(e) => !e.open && closeAddPathDialog()}>
        <DialogContent
          bg={theme.cardBg}
          borderColor={assetColor}
          borderWidth="2px"
          borderRadius="xl"
          maxW="600px"
          p={8}
        >
          <DialogHeader borderBottom={`1px solid ${theme.border}`} pb={6} mb={6}>
            <DialogTitle color={assetColor} fontSize="2xl" fontWeight="bold">
              Add New Path for {assetContext?.symbol}
            </DialogTitle>
            <DialogCloseTrigger />
          </DialogHeader>

          <DialogBody pt={0} pb={6}>
            <PathFormInputs
              note={pathManager.note}
              accountIndex={pathManager.accountIndex}
              addressIndex={pathManager.addressIndex}
              derivationPath={pathManager.derivationPath}
              assetContext={assetContext}
              error={pathManager.error}
              accentColor={assetColor}
              onNoteChange={pathManager.setNote}
              onAccountIndexChange={pathManager.setAccountIndex}
              onAddressIndexChange={pathManager.setAddressIndex}
              compact={true}
            />
          </DialogBody>

          <DialogFooter borderTop={`1px solid ${theme.border}`} pt={6}>
            <Flex gap={4} width="100%">
              <Button
                flex={1}
                size="lg"
                height="56px"
                variant="ghost"
                onClick={closeAddPathDialog}
                color="gray.400"
                _hover={{ bg: theme.border }}
                borderRadius="lg"
                disabled={pathManager.loading}
              >
                Cancel
              </Button>
              <Button
                flex={2}
                size="lg"
                height="56px"
                onClick={handleAddPath}
                disabled={pathManager.loading || !pathManager.note.trim()}
                bg={assetColor}
                color="black"
                _hover={{ bg: assetColorHover }}
                _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                borderRadius="lg"
                fontWeight="bold"
              >
                {pathManager.loading ? (
                  <Flex gap={3} align="center">
                    <Spinner size="sm" color="black" />
                    <Text>Adding Path...</Text>
                  </Flex>
                ) : (
                  <Flex gap={3} align="center">
                    <FaPlus />
                    <Text>Add Path</Text>
                  </Flex>
                )}
              </Button>
            </Flex>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </Box>
  );
};

export default Send; 