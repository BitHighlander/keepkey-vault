/**
 * AssetIcon Component
 *
 * Unified component for displaying asset/coin icons with CAIP-based fallback cascade.
 *
 * Fallback Strategy (CAIP identifiers only - NO symbol-based lookups):
 * 1. Primary URL (from Pioneer SDK/props)
 * 2. KeepKey API (api.keepkey.info) with base64-encoded CAIP
 * 3. Generic coin icon (FaCoins) as final fallback
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
import { getAssetIconUrl } from '@/lib/utils/assetIcons';
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
      console.log('🖼️ [AssetIcon] No primary URL provided');
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
      // Level 1: Try KeepKey API with base64 CAIP
      const apiUrl = getAssetIconUrl(caip);
      if (debug) console.log('🔄 [AssetIcon] Trying KeepKey API fallback:', apiUrl);
      setCurrentSrc(apiUrl);
      setFallbackLevel(1);
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
        bg="rgba(255, 255, 255, 0.12)"
        borderRadius="full"
        boxShadow="0 0 0 2.5px rgba(255, 255, 255, 0.4), 0 0 12px rgba(255, 255, 255, 0.2), 0 4px 12px rgba(0, 0, 0, 0.4)"
        backdropFilter="blur(8px)"
        position="relative"
        _before={{
          content: '""',
          position: 'absolute',
          inset: '2.5px',
          borderRadius: 'full',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.15) 100%)',
          pointerEvents: 'none',
        }}
        _after={{
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: 'full',
          background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      >
        <Box position="relative" zIndex={1} filter="drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5))">
          <FaCoins />
        </Box>
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
      bg="rgba(255, 255, 255, 0.12)"
      borderRadius="full"
      p="3px"
      position="relative"
      boxShadow="0 0 0 2.5px rgba(255, 255, 255, 0.4), 0 0 12px rgba(255, 255, 255, 0.2), 0 4px 12px rgba(0, 0, 0, 0.4)"
      backdropFilter="blur(8px)"
      _before={{
        content: '""',
        position: 'absolute',
        inset: '2.5px',
        borderRadius: 'full',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.15) 100%)',
        pointerEvents: 'none',
      }}
      _after={{
        content: '""',
        position: 'absolute',
        inset: 0,
        borderRadius: 'full',
        background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3) 0%, transparent 60%)',
        pointerEvents: 'none',
      }}
    >
      <Image
        key={imageKey}
        src={currentSrc}
        alt={alt}
        boxSize="100%"
        objectFit="contain"
        onError={handleError}
        onLoad={handleLoad}
        borderRadius="full"
        position="relative"
        zIndex={1}
        filter="drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5))"
        fallback={
          <Box
            boxSize="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color={color}
            position="relative"
            zIndex={1}
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
