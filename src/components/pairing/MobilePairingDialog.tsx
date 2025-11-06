'use client';

import { useState, useEffect } from 'react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogBackdrop,
  DialogCloseTrigger,
  DialogActionTrigger,
} from '@/components/ui/dialog';
import { Box, Text, VStack, HStack, Code, Spinner, Button } from '@chakra-ui/react';
import QRCode from 'qrcode';
import { usePioneerContext } from '@/components/providers/pioneer';
import { FaMobileAlt, FaRedo } from 'react-icons/fa';

interface PairingResponse {
  success: boolean;
  code: string;
  expiresAt: number;
  expiresIn: number;
}

interface MobilePairingDialogProps {
  open: boolean;
  onClose: () => void;
}

// Theme colors matching the project
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

export function MobilePairingDialog({ open, onClose }: MobilePairingDialogProps) {
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (open && app) {
      generatePairing();
    }
  }, [open, app]);

  const generatePairing = async () => {
    try {
      setLoading(true);
      setError('');

      // Validate we have required data
      if (!app) {
        throw new Error('Pioneer SDK not initialized');
      }

      // Debug logging for context
      console.log('🔍 [Pairing] state.context:', state.context);
      console.log('🔍 [Pairing] app.context:', app.context);
      console.log('🔍 [Pairing] app.keepKeySdk:', !!app.keepKeySdk);

      // Check if KeepKey is connected (check SDK first, then context)
      if (!app.keepKeySdk) {
        console.error('❌ [Pairing] KeepKey SDK not found');
        console.error('   - app.keepKeySdk:', app.keepKeySdk);
        console.error('   - state.context:', state.context);
        console.error('   - state.pubkeys:', state.pubkeys?.length || 0);
        throw new Error('No KeepKey device connected. Please ensure:\n1. Your KeepKey is plugged in\n2. KeepKey Vault extension is running\n3. You\'ve unlocked your device');
      }

      // Also check context if available (secondary validation)
      if (!state.context || !state.context.includes('keepkey:')) {
        console.warn('⚠️ [Pairing] Context missing or invalid, but SDK is present. Continuing...');
      }

      // Get device features first
      console.log('🔍 [Pairing] Attempting to get device features...');
      console.log('🔍 [Pairing] app.keepKeySdk.system:', !!app.keepKeySdk?.system);
      console.log('🔍 [Pairing] app.keepKeySdk.system.info:', !!app.keepKeySdk?.system?.info);
      
      let features;
      try {
        features = await app.keepKeySdk?.system.info.getFeatures();
        console.log('✅ [Pairing] Device features received:', features);
        console.log('🔍 [Pairing] Features keys:', Object.keys(features || {}));
        console.log('🔍 [Pairing] Full features object:', JSON.stringify(features, null, 2));
      } catch (featuresError) {
        console.error('❌ [Pairing] Failed to get device features:', featuresError);
        throw new Error(`Failed to get device features: ${(featuresError as Error).message}`);
      }

      // Get device label from context (if available) or features
      let deviceLabel = 'My KeepKey';
      if (state.context && state.context.includes('keepkey:')) {
        deviceLabel = state.context.replace('keepkey:', '').replace('.json', '');
      } else if (features?.label) {
        deviceLabel = features.label;
      }

      console.log('🏷️ [Pairing] Device label:', deviceLabel);
      console.log('🆔 [Pairing] Device ID from features:', features?.deviceId);
      console.log('🆔 [Pairing] Device ID from features.device_id:', (features as any)?.device_id);
      
      // Try to get deviceId from multiple possible locations
      let deviceId = features?.deviceId || (features as any)?.device_id;
      
      // If still no deviceId, try to generate one from the context or use a fallback
      if (!deviceId && state.context) {
        // Use the device label as a stable identifier
        deviceId = deviceLabel || 'keepkey-device';
        console.log('⚠️ [Pairing] Using device label as fallback deviceId:', deviceId);
      }

      if (!features || !deviceId) {
        console.error('❌ [Pairing] Invalid device features:', { 
          features, 
          hasDeviceId: !!deviceId,
          hasContext: !!state.context,
          deviceLabel 
        });
        throw new Error('Could not get device information. Device may not be ready or unlocked.');
      }
      
      console.log('✅ [Pairing] Using deviceId:', deviceId);

      // Get all pubkeys
      const pubkeys = state.pubkeys || [];
      if (pubkeys.length === 0) {
        throw new Error('No pubkeys available. Please ensure device is initialized.');
      }

      console.log('🔑 [Pairing] Total pubkeys:', pubkeys.length);
      console.log('🔑 [Pairing] First pubkey sample:', {
        hasPubkey: !!pubkeys[0]?.pubkey,
        hasPathMaster: !!pubkeys[0]?.pathMaster,
        hasNetworks: !!pubkeys[0]?.networks,
        networksLength: pubkeys[0]?.networks?.length,
        hasAddress: !!pubkeys[0]?.address,
        hasMaster: !!pubkeys[0]?.master,
      });

      // Validate pubkeys have required fields
      const invalidPubkeys = pubkeys.filter((pk: any) => 
        !pk.pubkey || !pk.pathMaster || !pk.networks || !Array.isArray(pk.networks)
      );
      
      if (invalidPubkeys.length > 0) {
        console.error('❌ [Pairing] Invalid pubkeys found:', invalidPubkeys.length);
        console.error('❌ [Pairing] Sample invalid pubkey:', invalidPubkeys[0]);
        throw new Error(`${invalidPubkeys.length} pubkeys are missing required fields (pubkey, pathMaster, or networks)`);
      }

      console.log('✅ [Pairing] All pubkeys validated successfully');

      // Prepare the request payload
      const pairingPayload = {
        deviceId: deviceId,
        label: deviceLabel || features.label || 'My KeepKey',
        pubkeys: pubkeys.map((pk: any) => ({
          pubkey: pk.pubkey,
          pathMaster: pk.pathMaster,
          networks: pk.networks,
          address: pk.address,
          master: pk.master,
          note: pk.note,
          type: pk.type,
        })),
      };

      console.log('📤 [Pairing] Sending request to /api/pairing');
      console.log('📤 [Pairing] Payload summary:', {
        deviceId: pairingPayload.deviceId,
        label: pairingPayload.label,
        pubkeysCount: pairingPayload.pubkeys.length,
        firstPubkey: pairingPayload.pubkeys[0] ? {
          networks: pairingPayload.pubkeys[0].networks?.slice(0, 3),
          hasAddress: !!pairingPayload.pubkeys[0].address,
          hasMaster: !!pairingPayload.pubkeys[0].master,
        } : null
      });
      console.log('📤 [Pairing] Full payload:', JSON.stringify(pairingPayload, null, 2));

      // Call backend API to create pairing
      let response;
      try {
        response = await fetch('/api/pairing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pairingPayload),
        });
        
        console.log('📥 [Pairing] Response status:', response.status);
        console.log('📥 [Pairing] Response statusText:', response.statusText);
        console.log('📥 [Pairing] Response headers:', Object.fromEntries(response.headers.entries()));
      } catch (fetchError) {
        console.error('❌ [Pairing] Network request failed:', fetchError);
        console.error('❌ [Pairing] Error type:', (fetchError as Error).name);
        console.error('❌ [Pairing] Error message:', (fetchError as Error).message);
        throw new Error(`Network request failed: ${(fetchError as Error).message}`);
      }

      if (!response.ok) {
        console.error('❌ [Pairing] API returned error status:', response.status);
        let errorData;
        try {
          const responseText = await response.text();
          console.log('📥 [Pairing] Raw error response:', responseText);
          errorData = JSON.parse(responseText);
          console.error('❌ [Pairing] Error data:', errorData);
        } catch (parseError) {
          console.error('❌ [Pairing] Could not parse error response:', parseError);
          throw new Error(`Failed to create pairing (status ${response.status})`);
        }
        throw new Error(errorData.error || `Failed to create pairing (status ${response.status})`);
      }

      const data: PairingResponse = await response.json();

      if (!data.success || !data.code) {
        throw new Error('Invalid response from pairing API');
      }

      console.log('✅ Pairing created:', data.code);
      console.log('   Expires in:', Math.floor(data.expiresIn / 60), 'minutes');

      setPairingCode(data.code);
      setExpiresAt(data.expiresAt);

      // Generate tiny QR code
      const vaultUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

      const qrPayload = {
        code: data.code,
        url: vaultUrl,
      };

      const dataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
      });

      setQrDataUrl(dataUrl);
      setLoading(false);
    } catch (err: any) {
      console.error('Pairing generation error:', err);
      setError(err.message || 'Failed to generate pairing');
      setLoading(false);
    }
  };

  const formatExpiresIn = (expiresAt: number): string => {
    if (!expiresAt) return '';
    const diff = expiresAt - Date.now();
    if (diff <= 0) return 'Expired';
    const minutes = Math.ceil(diff / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()}>
      <DialogBackdrop />
      <DialogContent maxWidth="500px" bg={theme.cardBg} borderColor={theme.border}>
        <DialogHeader borderBottomWidth="1px" borderColor={theme.border}>
          <HStack gap={2}>
            <FaMobileAlt color={theme.gold} />
            <DialogTitle color={theme.gold}>Pair Mobile Device</DialogTitle>
          </HStack>
        </DialogHeader>
        <DialogCloseTrigger />

        <DialogBody>
          <VStack gap={4} align="stretch">
            {loading && (
              <Box textAlign="center" py={8}>
                <Spinner size="xl" color={theme.gold} />
                <Text mt={4} color="gray.400">Generating pairing code...</Text>
              </Box>
            )}

            {error && (
              <Box
                bg="red.900"
                color="red.200"
                p={4}
                borderRadius="md"
                borderWidth={1}
                borderColor="red.700"
              >
                <Text fontWeight="bold">Error</Text>
                <Text fontSize="sm" mt={1}>{error}</Text>
              </Box>
            )}

            {!loading && !error && qrDataUrl && (
              <>
                {/* Pairing Code Display */}
                <Box textAlign="center" py={4} bg={theme.bg} borderRadius="md" borderWidth="1px" borderColor={theme.border}>
                  <Text fontSize="sm" color={theme.gold} mb={2}>
                    Pairing Code
                  </Text>
                  <Code fontSize="3xl" fontWeight="bold" letterSpacing="wider" bg={theme.cardBg} color={theme.gold} p={2}>
                    {pairingCode}
                  </Code>
                  <Text fontSize="xs" color="gray.500" mt={2}>
                    Expires in {formatExpiresIn(expiresAt)}
                  </Text>
                </Box>

                {/* QR Code */}
                <Box textAlign="center">
                  <Text fontSize="sm" color="gray.400" mb={2}>
                    Or scan QR code
                  </Text>
                  <img
                    src={qrDataUrl}
                    alt="Pairing QR Code"
                    style={{
                      width: '300px',
                      height: '300px',
                      margin: '0 auto',
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                    }}
                  />
                </Box>

                {/* Instructions */}
                <Box
                  bg={theme.bg}
                  p={4}
                  borderRadius="md"
                  borderWidth={1}
                  borderColor={theme.border}
                >
                  <Text fontWeight="bold" color={theme.gold} mb={2}>
                    Instructions:
                  </Text>
                  <VStack align="start" gap={2} fontSize="sm" color="gray.400">
                    <Text>1. Open KeepKey Mobile app on your phone</Text>
                    <Text>2. Tap &quot;Pair via QR Code&quot;</Text>
                    <Text>3. Scan the QR code or enter the code manually</Text>
                    <Text>4. Your portfolio will sync to mobile</Text>
                  </VStack>
                </Box>

                {/* Security Note */}
                <Box fontSize="xs" color="gray.500">
                  <Text fontWeight="bold" color={theme.gold}>Security:</Text>
                  <Text>• Code expires in 15 minutes</Text>
                  <Text>• One-time use only</Text>
                  <Text>• Public keys only (private keys never leave device)</Text>
                </Box>
              </>
            )}
          </VStack>
        </DialogBody>

        <DialogFooter borderTopWidth="1px" borderColor={theme.border}>
          <HStack gap={2}>
            <DialogActionTrigger asChild>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogActionTrigger>
            {!loading && !error && (
              <Button
                onClick={generatePairing}
                bg={theme.gold}
                color={theme.bg}
                _hover={{ bg: theme.goldHover }}
              >
                <HStack gap={2}>
                  <FaRedo />
                  <Text>Generate New Code</Text>
                </HStack>
              </Button>
            )}
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
