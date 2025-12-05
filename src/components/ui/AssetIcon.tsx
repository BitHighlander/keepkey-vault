/**
 * AssetIcon Component
 *
 * Unified component for displaying asset/coin icons with CAIP-based fallback cascade.
 *
 * Fallback Strategy (CAIP identifiers only - NO symbol-based lookups):
 * 1. Primary URL (from Pioneer SDK/props)
 * 2. KeepKey CDN (api.keepkey.info) with base64-encoded CAIP
 * 3. Localhost fallback (localhost:9001) with base64-encoded CAIP
 * 4. Generic coin icon (FaCoins) as final fallback
 *
 * IMPORTANT: All icon lookups use base64-encoded CAIP identifiers, never symbol names.
 * The CDN saves icons by CAIP hash, not by symbol.
 *
 * Usage:
 * ```tsx
 * <AssetIcon src={asset.icon} caip={asset.caip} alt={asset.name} boxSize="40px" />
 * <AssetIcon caip="eip155:1/slip44:60" alt="ETH" boxSize="24px" />
 * ```
 */

'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Box, Image } from '@chakra-ui/react';
import { FaCoins } from 'react-icons/fa';
import { getAssetIconUrl, getLocalIconUrl } from '@/lib/utils/assetIcons';
import { getNetworkIconUrl, extractNetworkId } from '@/lib/utils/networkIcons';

interface AssetIconProps {
  /** Primary icon URL (from Pioneer SDK) */
  src?: string | null;
  /** CAIP identifier (preferred for fallback) */
  caip?: string;
  /** Asset symbol (fallback if CAIP not available) */
  symbol?: string;
  /** Alt text for accessibility */
  alt: string;
  /** Icon size (e.g., "24px", "40px", "100%") */
  boxSize: string;
  /** Icon color (for fallback FaCoins icon) */
  color?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Show network badge overlay */
  showNetworkBadge?: boolean;
  /** Network ID for badge (CAIP networkId format) */
  networkId?: string;
}

export const AssetIcon: React.FC<AssetIconProps> = ({
  src,
  caip,
  symbol,
  alt,
  boxSize,
  color = '#FFD700',
  debug = false,
  showNetworkBadge = false,
  networkId,
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [fallbackLevel, setFallbackLevel] = useState<number>(0);
  const [showIconFallback, setShowIconFallback] = useState(false);
  const [imageKey, setImageKey] = useState(0); // Force re-render on src change

  // Clean and validate primary URL
  const cleanUrl = useMemo(() => {
    if (!src || src.trim() === '') {
      if (debug) console.log('🖼️ [AssetIcon] No primary URL provided');
      return null;
    }

    // Handle comma-separated URLs (take first valid one)
    if (src.includes(',')) {
      const urls = src.split(',')
        .map(u => u.trim())
        .filter(u => u.startsWith('http://') || u.startsWith('https://'));

      const firstUrl = urls[0] || null;
      if (debug) console.log('🖼️ [AssetIcon] Multi-URL detected, using first:', firstUrl);
      return firstUrl;
    }

    // Validate URL has protocol
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
      if (debug) console.log('🖼️ [AssetIcon] Invalid URL (no protocol):', src);
      return null;
    }

    if (debug) console.log('🖼️ [AssetIcon] Valid primary URL:', src);
    return src;
  }, [src, debug]);

  // Try next fallback in the cascade - STABLE with useCallback
  const tryNextFallback = useCallback((currentLevel: number) => {
    const nextLevel = currentLevel + 1;

    if (debug) console.log(`🔄 [AssetIcon] Trying fallback level ${nextLevel} (current: ${currentLevel})`);

    if (nextLevel === 1 && caip) {
      // Level 1: Try KeepKey CDN with base64 CAIP
      const cdnUrl = getAssetIconUrl(caip);
      if (debug) console.log('🔄 [AssetIcon] Trying CDN fallback:', cdnUrl);
      setCurrentSrc(cdnUrl);
      setFallbackLevel(1);
      setImageKey(prev => prev + 1);
      return;
    }

    if (nextLevel === 2 && caip) {
      // Level 2: Try localhost with base64 CAIP
      const localUrl = getLocalIconUrl(caip);
      if (debug) console.log('🔄 [AssetIcon] Trying localhost fallback:', localUrl);
      setCurrentSrc(localUrl);
      setFallbackLevel(2);
      setImageKey(prev => prev + 1);
      return;
    }

    // Final fallback: Show icon (NO symbol-based fallback - CAIP only!)
    if (debug) console.log('❌ [AssetIcon] All fallbacks failed, using icon fallback');
    setShowIconFallback(true);
    setCurrentSrc(null);
  }, [caip, debug]);

  // Initialize currentSrc when cleanUrl changes
  useEffect(() => {
    if (cleanUrl) {
      if (debug) console.log('🖼️ [AssetIcon] Setting primary URL:', cleanUrl);
      setCurrentSrc(cleanUrl);
      setFallbackLevel(0);
      setShowIconFallback(false);
      setImageKey(prev => prev + 1);
    } else {
      // No primary URL, try CDN immediately
      if (debug) console.log('🖼️ [AssetIcon] No primary URL, starting fallback cascade');
      tryNextFallback(0);
    }
  }, [cleanUrl, tryNextFallback, debug]);

  // Handle image load error
  const handleError = useCallback(() => {
    if (debug) console.log(`❌ [AssetIcon] Image failed at level ${fallbackLevel}:`, currentSrc);
    tryNextFallback(fallbackLevel);
  }, [fallbackLevel, currentSrc, tryNextFallback, debug]);

  // Handle successful image load
  const handleLoad = useCallback(() => {
    if (debug) console.log(`✅ [AssetIcon] Image loaded successfully at level ${fallbackLevel}:`, currentSrc);
  }, [fallbackLevel, currentSrc, debug]);

  // Get network icon URL if badge is requested - MUST BE BEFORE CONDITIONAL RETURN
  const networkIconUrl = useMemo(() => {
    if (!showNetworkBadge) return null;
    const netId = networkId || (caip ? extractNetworkId(caip) : null);
    return netId ? getNetworkIconUrl(netId) : null;
  }, [showNetworkBadge, networkId, caip]);

  // Show icon fallback
  if (showIconFallback || !currentSrc) {
    if (debug) console.log('🎨 [AssetIcon] Rendering FaCoins fallback');
    return (
      <Box
        boxSize={boxSize}
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontSize="lg"
        color={color}
        bg="rgba(255, 255, 255, 0.05)"
        borderRadius="md"
      >
        <FaCoins />
      </Box>
    );
  }

  // Show image
  return (
    <Box
      boxSize={boxSize}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(255, 255, 255, 0.1)"
      borderRadius="md"
      p="3px"
      position="relative"
      boxShadow="0 0 0 1px rgba(255, 255, 255, 0.15)"
    >
      <Image
        key={imageKey}
        src={currentSrc}
        alt={alt}
        boxSize="100%"
        objectFit="contain"
        onError={handleError}
        onLoad={handleLoad}
        fallback={
          <Box
            boxSize="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color={color}
          >
            <FaCoins />
          </Box>
        }
      />

      {/* Network Badge Overlay */}
      {showNetworkBadge && networkIconUrl && (
        <Box
          position="absolute"
          bottom="-2px"
          right="-2px"
          boxSize="40%"
          minW="14px"
          minH="14px"
          bg="rgba(0, 0, 0, 0.8)"
          borderRadius="full"
          border="2px solid rgba(255, 255, 255, 0.2)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          <Image
            src={networkIconUrl}
            alt="Network"
            boxSize="100%"
            objectFit="contain"
            fallback={<Box boxSize="100%" />}
          />
        </Box>
      )}
    </Box>
  );
};

export default AssetIcon;
