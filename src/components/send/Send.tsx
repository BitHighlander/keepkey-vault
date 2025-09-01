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
import { FaArrowRight, FaPaperPlane, FaTimes, FaWallet, FaExternalLinkAlt, FaCheck, FaCopy } from 'react-icons/fa'
import Confetti from 'react-confetti'
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph'
import { keyframes } from '@emotion/react'

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
  'eip155:1',    // Ethereum
  'eip155:56',   // BSC
  'eip155:137',  // Polygon
  'eip155:43114', // Avalanche
  'eip155:8453', // Base
  'eip155:10',   // Optimism
]

// TypeScript interfaces for transaction data
interface SendPayload {
  caip: string;
  to: string;
  amount: string;
  feeLevel: number;
  isMax: boolean;
  memo?: string;
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
  
  // Add state to track if we're entering amount in USD
  const [isUsdInput, setIsUsdInput] = useState<boolean>(false)
  
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
  const [feeRates, setFeeRates] = useState<any>(null)
  const [feeOptions, setFeeOptions] = useState<{slow: string, average: string, fastest: string}>({ slow: '0', average: '0', fastest: '0' })
  // Add state for raw transaction dialog
  const [showRawTxDialog, setShowRawTxDialog] = useState<boolean>(false)
  const [rawTxJson, setRawTxJson] = useState<string>('')
  const [editedRawTxJson, setEditedRawTxJson] = useState<string>('')
  
  // Add a state to track if asset data has loaded
  const [assetLoaded, setAssetLoaded] = useState<boolean>(false)
  
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

  // Calculate total balance - sum all pubkey balances for UTXO chains
  useEffect(() => {
    if (assetContext) {
      try {
        // Store previous balance for comparison
        const prevBalance = balance;
        
        let newBalance = '0';
        
        // Check if this is a UTXO network (Bitcoin, etc.)
        const networkId = assetContext.networkId || assetContext.caip || '';
        const isUtxoNetwork = UTXO_NETWORKS.some(id => networkId.includes(id)) || networkId.startsWith('bip122:');
        
        if (isUtxoNetwork && assetContext.pubkeys && assetContext.pubkeys.length > 0) {
          // For UTXO chains, sum all pubkey balances
          console.log('Calculating UTXO balance from pubkeys:', assetContext.pubkeys);
          
          let totalBalance = 0;
          for (const pubkey of assetContext.pubkeys) {
            // Find corresponding balance for this pubkey
            const pubkeyBalance = app?.balances?.find((b: any) => 
              b.pubkey === pubkey.pubkey || 
              b.address === pubkey.address ||
              b.master === pubkey.master
            );
            
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
          // For non-UTXO chains or if no pubkeys, use the single balance
          newBalance = assetContext.balance || '0';
        }
        
        setBalance(newBalance)
        setTotalBalanceUsd(parseFloat(newBalance) * (assetContext.priceUsd || 0))
        setAssetLoaded(true)
        setLoading(false)
        
        // Play chaching sound if balance increased
        if (prevBalance && newBalance && parseFloat(newBalance) > parseFloat(prevBalance)) {
          playSound(chachingSound);
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
  }, [assetContext, assetLoaded, estimatedFee])

  // Format USD value
  const formatUsd = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    })
  }

  // Convert USD to native token amount
  const usdToNative = (usdAmount: string): string => {
    if (!usdAmount || !assetContext.priceUsd || parseFloat(assetContext.priceUsd) === 0) return '0';
    const parsedUsd = parseFloat(usdAmount);
    const parsedPrice = parseFloat(assetContext.priceUsd);
    
    // Check for NaN or invalid values
    if (isNaN(parsedUsd) || isNaN(parsedPrice) || parsedPrice === 0) {
      console.warn('Invalid USD to native conversion:', { usdAmount, priceUsd: assetContext.priceUsd });
      return '0';
    }
    
    const nativeAmount = parsedUsd / parsedPrice;
    
    // Check if result is NaN
    if (isNaN(nativeAmount)) {
      console.warn('NaN result in USD to native conversion:', { parsedUsd, parsedPrice });
      return '0';
    }
    
    // Return formatted with appropriate decimal places
    return nativeAmount.toFixed(8);
  }

  // Convert native token amount to USD
  const nativeToUsd = (nativeAmount: string): string => {
    if (!nativeAmount || !assetContext.priceUsd) return '0';
    const usdAmount = parseFloat(nativeAmount) * parseFloat(assetContext.priceUsd);
    // Return with 2 decimal places for USD
    return usdAmount.toFixed(2);
  }

  // Calculate fee in USD
  const updateFeeInUsd = (feeInNative: string) => {
    if (!feeInNative || !assetContext?.priceUsd) {
      setEstimatedFeeUsd('0.00');
      return;
    }
    
    try {
      let feeValue = parseFloat(feeInNative);
      
      // Get network type for proper unit conversion
      let networkId = assetContext.networkId || '';
      
      // Handle wildcard network IDs
      if (networkId.includes('*') && assetContext.caip) {
        const caipParts = assetContext.caip.split('/');
        if (caipParts[0] && !caipParts[0].includes('*')) {
          networkId = caipParts[0];
        }
      }
      
      const networkType = getNetworkType(networkId);
      
      // Special handling based on network type
      if (networkType === 'EVM' && feeValue > 1) {
        // Convert from gwei to ETH equivalent
        const gweiToEth = 0.000000001;
        feeValue = feeValue * gweiToEth;
      } else if (networkType === 'UTXO') {
        // For UTXO chains, the API might return fee in satoshis
        // Check if the fee seems too large (likely in satoshis)
        if (feeValue > 0.1) {
          // Convert from satoshis to full coin value (1 BCH = 100,000,000 satoshis)
          feeValue = feeValue / 100000000;
        }
      }
      
      const feeUsd = feeValue * parseFloat(assetContext.priceUsd);
      setEstimatedFeeUsd(feeUsd.toFixed(2));
    } catch (error) {
      console.error('Error calculating fee in USD:', error);
      setEstimatedFeeUsd('0.00');
    }
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

  // Fetch fee rates from Pioneer API
  const fetchFeeRates = async () => {
    if (!assetContext) {
      setError('Asset context not available');
      return;
    }
    
    // Try to get a valid network ID from various sources
    let networkId = assetContext.networkId;
    
    // If networkId contains wildcard, try to extract from CAIP
    if (networkId?.includes('*')) {
      // Try to get from CAIP identifier (e.g., eip155:1/slip44:60 -> eip155:1)
      if (assetContext.caip) {
        const caipParts = assetContext.caip.split('/');
        if (caipParts[0] && !caipParts[0].includes('*')) {
          networkId = caipParts[0];
        }
      }
      
      // If still has wildcard, try assetId
      if (networkId?.includes('*') && assetContext.assetId) {
        const assetParts = assetContext.assetId.split('/');
        if (assetParts[0] && !assetParts[0].includes('*')) {
          networkId = assetParts[0];
        }
      }
    }
    
    if (!networkId || networkId.includes('*')) {
      setError('Cannot determine specific network chain ID');
      console.error('Invalid network ID:', networkId, 'Asset context:', assetContext);
      return;
    }
    
    try {
      if (!app?.pioneer) {
        throw new Error('Pioneer API not available');
      }

      console.log('Fetching fee rates for network:', networkId);
      
      // Try different API call methods to work around server-side routing issue
      let feeRates;
      try {
        console.log('Fetching fee rates for network:', networkId);
        
        // Call the GetFeeRate API with proper CAIP network ID
        if (app.pioneer.GetFeeRateByNetwork) {
          feeRates = await app.pioneer.GetFeeRateByNetwork({ networkId: networkId });
        } else {
          feeRates = await app.pioneer.GetFeeRate({ networkId: networkId });
        }
      } catch (apiError) {
        console.error('Primary API call failed:', apiError);
        // Don't use network name fallbacks - the server now properly handles CAIP IDs
        throw apiError;
      }
      
      console.log('Fee rates from API:', feeRates);

      // Store the complete fee rates data for use in the UI
      setFeeRates(feeRates);
      
      // Handle both response formats: direct object or wrapped in data property
      const feeData = feeRates?.data || feeRates;
      
      if (!feeData) {
        throw new Error('No fee data returned from API');
      }

      //{slow: '1', average: '1', fastest: '1'}
      // The API returns fastest, fast, average - map to our UI's slow, average, fastest
      if (!feeData.average || !feeData.fast || !feeData.fastest) {
        throw new Error('Incomplete fee data from API');
      }
      
      // Map API response to UI fee levels
      // API returns: fastest (high priority), fast (medium), average (low priority)
      // UI expects: slow (low priority), average (medium), fastest (high priority)
      const fees = {
        slow: feeData.average.toString(),    // Use 'average' for slow
        average: feeData.fast.toString(),     // Use 'fast' for average
        fastest: feeData.fastest.toString()   // Use 'fastest' for fastest
      };
      
      // Log the fee unit if provided
      if (feeData.unit) {
        console.log('Fee unit:', feeData.unit);
        console.log('Fee description:', feeData.description);
      }
      
      console.log('Using fees from API:', fees);
      
      // Store the raw fee options (gas prices)
      setFeeOptions(fees);
      
      // For EVM chains with Gwei fees, calculate actual transaction fee
      if (feeData.unit === 'gwei') {
        // Gas price is in Gwei, need to calculate with gas limit (21000 for simple transfer)
        const gasLimit = 21000; // Standard ETH transfer
        const gasPriceGwei = parseFloat(fees[selectedFeeLevel]);
        const feeInGwei = gasPriceGwei * gasLimit;
        const feeInEth = feeInGwei / 1e9; // Convert Gwei to ETH
        const feeString = feeInEth.toFixed(9);
        
        console.log('Calculated EVM fee:', {
          gasPriceGwei,
          gasLimit,
          feeInGwei,
          feeInEth,
          feeString
        });
        
        setEstimatedFee(feeString);
        updateFeeInUsd(feeString);
      } else {
        // For non-EVM chains, use the fee directly
        setEstimatedFee(fees[selectedFeeLevel]);
        updateFeeInUsd(fees[selectedFeeLevel]);
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
      setFeeOptions({ slow: '0', average: '0', fastest: '0' });
      setEstimatedFee('0');
    }
  };
  

  // Handle fee selection change
  const handleFeeSelectionChange = (feeLevel: FeeLevel) => {
    setSelectedFeeLevel(feeLevel);
    setCustomFeeOption(false);
    
    // The FeeSelection component handles the fee data internally
    // We just update the selection state here
    // Fee calculation logic should be moved to a shared utility or hook
  };
  
  // Handle custom fee input
  const handleCustomFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and a single decimal point
    if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
      setCustomFeeAmount(value);
      
      if (value) {
        setEstimatedFee(value);
        updateFeeInUsd(value);
      }
    }
  };

  // Toggle between USD and native input
  const toggleInputMode = () => {
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

  // Handle send transaction
  const handleSend = async () => {
    if (!amount || !recipient) {
      console.error('Missing fields')
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

  // Build transaction
  const buildTransaction = async () => {
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
      
      // Map fee levels to SDK fee level values
      const feeLevelMap = {
        slow: 1,
        average: 5,
        fastest: 9
      };
      
      const sendPayload: SendPayload = {
        caip,
        to: recipient,
        amount: nativeAmount,
        feeLevel: customFeeOption ? 5 : feeLevelMap[selectedFeeLevel], // Use selected or custom fee level
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
      
      console.log('Build TX Payload:', sendPayload)
      
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
            // Direct fee field
            feeValue = typeof unsignedTxResult.fee === 'string' 
              ? unsignedTxResult.fee 
              : unsignedTxResult.fee.toString();
          } else if (unsignedTxResult.feeValue) {
            feeValue = unsignedTxResult.feeValue.toString();
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
  
  // Sign transaction
  const signTransaction = async (txState: TransactionState) => {
    setLoading(true)
    try {
      const caip = assetContext?.caip || assetContext?.assetId
      
      if (!txState?.unsignedTx) {
        throw new Error('No unsigned transaction to sign')
      }
      
      console.log('Signing TX:', txState.unsignedTx)
      
      // Call the SDK's signTx method
      const signedTxResult = await app.signTx({ 
        caip, 
        unsignedTx: txState.unsignedTx 
      })
      
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
  
  // Format transaction details for display
  const formatTransactionDetails = (tx: any): React.ReactNode => {
    if (!tx) return null;
    
    // Get network type for formatting
    const networkType = assetContext?.networkId ? getNetworkType(assetContext.networkId) : 'OTHER';
    const isBCH = assetContext?.networkId?.includes('bitcoincash') || 
                  assetContext?.networkId?.includes('bip122:000000000000000000651ef99cb9fcbe');
    
    // Different formatting based on network type
    switch (networkType) {
      case 'UTXO': {
        return (
          <Box width="100%">
            <Text color="gray.500" fontSize="sm" mb={1}>Transaction Details</Text>
            {tx.inputs && tx.inputs.length > 0 && (
              <Box mb={3}>
                <Text color="gray.500" fontSize="xs">Inputs ({tx.inputs.length})</Text>
                <Box maxH="100px" overflowY="auto" mt={1} p={2} bg="rgba(0,0,0,0.2)" borderRadius="md" fontSize="xs">
                  {tx.inputs.map((input: any, idx: number) => (
                    <Text key={idx} fontFamily="mono" color="white" fontSize="10px" mb={1}>
                      {input.txid?.substring(0, 8)}...{input.txid?.substring(input.txid.length - 8)} : {input.vout} 
                      {input.value && ` (${input.value} sats)`}
                    </Text>
                  ))}
                </Box>
              </Box>
            )}
            
            {tx.outputs && tx.outputs.length > 0 && (
              <Box>
                <Text color="gray.500" fontSize="xs">Outputs ({tx.outputs.length})</Text>
                <Box maxH="100px" overflowY="auto" mt={1} p={2} bg="rgba(0,0,0,0.2)" borderRadius="md" fontSize="xs">
                  {tx.outputs.map((output: any, idx: number) => (
                    <Text key={idx} fontFamily="mono" color="white" fontSize="10px" mb={1} wordBreak="break-all">
                      {output.address ? (
                        <>
                          {output.address?.substring(0, 8)}...{output.address?.substring(output.address.length - 8)}
                          {output.amount && ` (${output.amount} sats)`}
                        </>
                      ) : (
                        <>
                          Change output
                          {output.amount && ` (${output.amount} sats)`}
                        </>
                      )}
                    </Text>
                  ))}
                </Box>
              </Box>
            )}
            
            {tx.fee && (
              <Flex justify="space-between" mt={2}>
                <Text color="gray.500" fontSize="xs">Transaction Fee</Text>
                <Text color="white" fontSize="xs">{tx.fee} sats</Text>
              </Flex>
            )}
          </Box>
        );
      }
      
      case 'EVM': {
        return (
          <Box width="100%">
            <Text color="gray.500" fontSize="sm" mb={1}>Transaction Details</Text>
            <Box maxH="150px" overflowY="auto" mt={1} p={2} bg="rgba(0,0,0,0.2)" borderRadius="md" fontSize="xs">
              {tx.to && (
                <Flex justify="space-between" mb={1}>
                  <Text color="gray.500">To:</Text>
                  <Text color="white" fontFamily="mono" wordBreak="break-all">{tx.to}</Text>
                </Flex>
              )}
              {tx.value && (
                <Flex justify="space-between" mb={1}>
                  <Text color="gray.500">Value:</Text>
                  <Text color="white" fontFamily="mono">{tx.value}</Text>
                </Flex>
              )}
              {tx.gasLimit && (
                <Flex justify="space-between" mb={1}>
                  <Text color="gray.500">Gas Limit:</Text>
                  <Text color="white" fontFamily="mono">{tx.gasLimit}</Text>
                </Flex>
              )}
              {tx.gasPrice && (
                <Flex justify="space-between" mb={1}>
                  <Text color="gray.500">Gas Price:</Text>
                  <Text color="white" fontFamily="mono">{tx.gasPrice} Gwei</Text>
                </Flex>
              )}
            </Box>
          </Box>
        );
      }
      
      default:
        // For other chains, just show the JSON structure
        return (
          <Box width="100%">
            <Text color="gray.500" fontSize="sm" mb={1}>Transaction Details</Text>
            <Box maxH="150px" overflowY="auto" mt={1} p={2} bg="rgba(0,0,0,0.2)" borderRadius="md" fontSize="xs">
              <Text color="white" fontFamily="mono" wordBreak="break-all">
                {JSON.stringify(tx, null, 2)}
              </Text>
            </Box>
          </Box>
        );
    }
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
    
    // Transaction in progress
    return (
      <Box height="100vh" bg={theme.bg}>
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
                {transactionStep === 'review' ? 'Review Transaction' : 
                 transactionStep === 'sign' ? 'Signing Transaction' : 
                 transactionStep === 'broadcast' ? 'Broadcasting Transaction' : 'Confirm Transaction'}
              </Text>
              <IconButton
                aria-label="Close"
                onClick={closeConfirmation}
                size="sm"
                variant="ghost"
                color={assetColor}
                disabled={loading}
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
            {/* Loading overlay for signing and broadcasting */}
            {(loading && (transactionStep === 'sign' || transactionStep === 'broadcast')) && (
              <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                bg="rgba(0, 0, 0, 0.8)"
                zIndex={1000}
                display="flex"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                p={4}
              >
                {transactionStep === 'sign' ? (
                  <>
                    <Image 
                      src="/images/hold-and-release.svg"
                      alt="Hold and Release Button on KeepKey"
                      width="200px"
                      mb={6}
                    />
                    <Text color={assetColor} fontSize="xl" fontWeight="bold" mb={2}>
                      Check Your KeepKey Device
                    </Text>
                    <Text color="gray.400" fontSize="md" textAlign="center" maxWidth="400px" mb={2}>
                      Please review the transaction details on your KeepKey
                    </Text>
                    <Text color="gray.400" fontSize="md" textAlign="center">
                      Hold the button to confirm or release to cancel
                    </Text>
                  </>
                ) : (
                  <>
                    <KeepKeyUiGlyph
                      boxSize="80px"
                      color={assetColor}
                      animation={`${scale} 2s ease-in-out infinite`}
                      mb={6}
                    />
                    <Text color={assetColor} fontSize="xl" fontWeight="bold" mb={2}>
                      Broadcasting Transaction...
                    </Text>
                    <Text color="gray.400" fontSize="md" textAlign="center">
                      Submitting transaction to the network
                    </Text>
                  </>
                )}
              </Box>
            )}
            
            <Stack gap={5}>
              {/* Asset Information */}
              <Flex align="center" gap={3} width="100%">
                <Box 
                  borderRadius="full" 
                  overflow="hidden" 
                  boxSize="40px"
                  p={1}
                  bg={theme.cardBg}
                  border="1px solid"
                  borderColor={theme.border}
                >
                  <Image 
                    src={assetContext.icon}
                    alt={`${assetContext.name} Icon`}
                    boxSize="100%"
                    objectFit="contain"
                  />
                </Box>
                <Box>
                  <Text fontWeight="bold" color="white">
                    {isUsdInput ? usdToNative(amount) : amount} {assetContext.symbol}
                  </Text>
                  <Text color="gray.400" fontSize="sm">
                    {formatUsd(parseFloat(isUsdInput ? amount : nativeToUsd(amount)))}
                  </Text>
                </Box>
              </Flex>
              
              {/* Recipient Details */}
              <Box 
                p={4}
                bg={theme.bg}
                border="1px solid"
                borderColor={theme.border}
                borderRadius="md"
                width="100%"
              >
                <Text fontSize="sm" color="gray.400" mb={1}>
                  Recipient
                </Text>
                <Text color="white" wordBreak="break-all" fontSize="sm">
                  {recipient}
                </Text>
                
                {memo && (
                  <>
                    <Text fontSize="sm" color="gray.400" mt={3} mb={1}>
                      Memo/Tag
                    </Text>
                    <Text color="white" wordBreak="break-all" fontSize="sm">
                      {memo}
                    </Text>
                  </>
                )}
              </Box>
              
              {/* Fee Details - Hide for XRP */}
              {!assetContext?.caip?.includes('ripple') && !assetContext?.networkId?.includes('ripple') && (
                <Box 
                  p={4}
                  bg={theme.bg}
                  border="1px solid"
                  borderColor={theme.border}
                  borderRadius="md"
                  width="100%"
                >
                  <Flex justify="space-between" align="center">
                    <Text fontSize="sm" color="gray.400">
                      Network Fee
                    </Text>
                    <Box textAlign="right">
                      <Text color="white" fontSize="sm">
                        {estimatedFee} {assetContext.symbol}
                      </Text>
                      <Text color="gray.400" fontSize="xs">
                        ≈ ${estimatedFeeUsd} USD
                      </Text>
                    </Box>
                  </Flex>
                  
                  <Flex justify="space-between" align="center" mt={3}>
                    <Text fontSize="sm" color="gray.400">
                      Total
                    </Text>
                    <Box textAlign="right">
                      <Text color="white" fontWeight="bold" fontSize="sm">
                        {(() => {
                          const nativeAmount = isUsdInput ? usdToNative(amount) : amount;
                          const totalNative = isMax ? balance : (parseFloat(nativeAmount || '0') + parseFloat(estimatedFee || '0')).toFixed(8);
                          return `${totalNative} ${assetContext.symbol}`;
                        })()}
                      </Text>
                      <Text color="gray.400" fontSize="xs">
                        {(() => {
                          const nativeAmount = isUsdInput ? usdToNative(amount) : amount;
                          const totalNative = parseFloat(nativeAmount || '0') + parseFloat(estimatedFee || '0');
                        return formatUsd(totalNative * (assetContext.priceUsd || 0));
                      })()}
                    </Text>
                  </Box>
                </Flex>
              </Box>
              )}
              
              {/* Transaction Details */}
              {unsignedTx && (
                <Box width="100%" mt={4}>
                  <Box 
                    as="button" 
                    onClick={() => setShowTxDetails(!showTxDetails)}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    width="100%"
                    p={2}
                    bg="transparent"
                    border="1px solid"
                    borderColor={theme.border}
                    borderRadius="md"
                    color="white"
                    _hover={{ borderColor: assetColor }}
                  >
                    <Text fontSize="sm">
                      {showTxDetails ? 'Hide Transaction Details' : 'Show Transaction Details'}
                    </Text>
                    <Box transform={showTxDetails ? 'rotate(180deg)' : 'none'} transition="transform 0.2s">
                      <FaArrowRight transform="rotate(90deg)" />
                    </Box>
                  </Box>
                  
                  {showTxDetails && (
                    <Box 
                      mt={3} 
                      p={3} 
                      borderRadius="md" 
                      bg={theme.bg} 
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      {formatTransactionDetails(unsignedTx?.unsignedTx)}
                      
                      {/* Add Raw Transaction Button */}
                      <Button
                        mt={3}
                        size="sm"
                        variant="outline"
                        width="100%"
                        borderColor={theme.border}
                        color={assetColor}
                        _hover={{ borderColor: assetColor, bg: assetColorLight }}
                        onClick={openRawTxDialog}
                      >
                        Edit Raw Transaction JSON
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Raw Transaction Dialog */}
              {showRawTxDialog && (
                <Box
                  position="fixed"
                  top="0"
                  left="0"
                  right="0"
                  bottom="0"
                  bg="rgba(0, 0, 0, 0.8)"
                  zIndex="1000"
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  p={4}
                >
                  <Box
                    bg={theme.cardBg}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={theme.border}
                    width="90%"
                    maxWidth="800px"
                    maxHeight="90vh"
                    overflow="hidden"
                    display="flex"
                    flexDirection="column"
                  >
                    <Box
                      p={4}
                      borderBottom="1px"
                      borderColor={theme.border}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Text color={assetColor} fontWeight="bold" fontSize="lg">
                        Raw Transaction JSON
                      </Text>
                      <IconButton
                        aria-label="Close"
                        size="sm"
                        variant="ghost"
                        color={assetColor}
                        onClick={closeRawTxDialog}
                      >
                        <FaTimes />
                      </IconButton>
                    </Box>
                    
                    <Box
                      p={4}
                      flex="1"
                      overflowY="auto"
                    >
                      <Text color="gray.400" fontSize="sm" mb={2}>
                        Edit the transaction JSON below:
                      </Text>
                      <Textarea
                        value={editedRawTxJson}
                        onChange={handleRawTxJsonChange}
                        p={3}
                        height="300px"
                        width="100%"
                        fontFamily="mono"
                        fontSize="sm"
                        color="white"
                        bg={theme.bg}
                        border="1px solid"
                        borderColor={theme.border}
                        borderRadius="md"
                        resize="vertical"
                        _focus={{
                          borderColor: assetColor,
                          outline: "none"
                        }}
                      />
                    </Box>
                    
                    <Box
                      p={4}
                      borderTop="1px"
                      borderColor={theme.border}
                      display="flex"
                      justifyContent="flex-end"
                      gap={3}
                    >
                      <Button
                        variant="outline"
                        color="gray.400"
                        borderColor={theme.border}
                        onClick={closeRawTxDialog}
                      >
                        Cancel
                      </Button>
                      <Button
                        bg={assetColor}
                        color="black"
                        _hover={{ bg: assetColorHover }}
                        onClick={applyEditedJson}
                      >
                        Apply Changes
                      </Button>
                    </Box>
                  </Box>
                </Box>
              )}
            </Stack>
          </Box>
          
          {/* Footer with Action Buttons */}
          <Box 
            borderTop="1px" 
            borderColor={theme.border}
            p={5}
          >
            <Stack gap={3}>
              <Button
                width="100%"
                bg={assetColor}
                color="black"
                _hover={{
                  bg: assetColorHover,
                }}
                onClick={confirmTransaction}
                loading={loading}
                height="56px"
                fontSize="lg"
                boxShadow={`0px 4px 12px ${assetColor}4D`}
              >
                Sign & Send
              </Button>
              
              <Button
                width="100%"
                variant="outline"
                color={assetColor}
                borderColor={theme.border}
                _hover={{
                  bg: 'rgba(255, 215, 0, 0.1)',
                  borderColor: assetColor,
                }}
                onClick={closeConfirmation}
                height="56px"
              >
                Cancel
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>
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
          {/* Asset Avatar and Info */}
          <Box 
            bg={theme.cardBg} 
            p={5} 
            borderRadius={theme.borderRadius}
            boxShadow="lg"
            border="1px solid"
            borderColor={theme.border}
            width="100%"
          >
            <VStack align="center" gap={4}>
              <Box 
                borderRadius="full" 
                overflow="hidden" 
                boxSize="70px"
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
              <Stack align="center" gap={1}>
                <Text fontSize="xl" fontWeight="bold" color="white">
                  {assetContext.name}
                </Text>
                <Stack>
                  <Text color="gray.400" fontSize="sm" textAlign="center">
                    Balance: {balance} {assetContext.symbol}
                  </Text>
                  <Text color={assetColor} fontSize="md" textAlign="center" fontWeight="medium">
                    {formatUsd(totalBalanceUsd)}
                  </Text>
                </Stack>
              </Stack>
            </VStack>
          </Box>
          
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
                  networkId={assetContext?.networkId || ''}
                  assetId={assetContext?.assetId}
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
            disabled={!amount || !recipient}
            height="56px"
            fontSize="lg"
            boxShadow={`0px 4px 12px ${assetColor}4D`}
          >
            <Flex gap={3} align="center" justify="center">
              <FaPaperPlane />
              <Text>Send {assetContext.symbol}</Text>
            </Flex>
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default Send; 