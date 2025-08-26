'use client'
// @ts-nocheck

import { Box, Flex } from "@chakra-ui/react"
import { keyframes } from '@emotion/react'
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph'
import Dashboard from '@/components/dashboard/Dashboard'
import { usePioneerContext } from '@/components/providers/pioneer'
import { useState, useEffect } from 'react'
// Background image path
const splashBg = '/images/backgrounds/splash-bg.png'

// Animated KeepKey logo pulse effect
const pulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
`;
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@/components/ui/dialog"
import Settings from '@/components/settings/Settings'
import AddBlockchain from '@/components/blockchain/AddBlockchain'
import { 
  ProductStructuredData,
  OrganizationStructuredData,
  SoftwareApplicationStructuredData 
} from '@/components/SEO/StructuredData'

export default function Home() {
  const pioneer = usePioneerContext();
  const { 
    state = {},
  } = pioneer || {};
  
  const { app } = state;
  
  // Show loading state only when data is not ready
  const showLoading = !app?.dashboard;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddBlockchainOpen, setIsAddBlockchainOpen] = useState(false);

  // Add debug logging for component mount and state changes
  useEffect(() => {
    console.log('🏠 [Page] Component mounted');
    return () => console.log('🏠 [Page] Component unmounting');
  }, []);

  useEffect(() => {
    console.log('🔄 [Page] State update:', {
      hasApp: !!app,
      hasAssetContext: !!app?.assetContext,
      hasDashboard: !!app?.dashboard,
      hasPioneer: !!pioneer,
      splashBgPath: splashBg // Debug: check if image imported correctly
    });
  }, [app, pioneer]);

  // Debug loading screen state
  useEffect(() => {
    if (showLoading) {
      console.log('🎬 [LOADING SCREEN] Showing loading screen with background:', splashBg);
    } else {
      console.log('✅ [LOADING SCREEN] Loading screen hidden');
    }
  }, [showLoading]);

  // Handle settings dialog open state
  const handleSettingsOpenChange = (details: { open: boolean }) => {
    setIsSettingsOpen(details.open);
  };

  // Handle add blockchain dialog open state
  const handleAddBlockchainOpenChange = (details: { open: boolean }) => {
    setIsAddBlockchainOpen(details.open);
  };

  // Show loading state if pioneer is not ready
  if (!pioneer) {
    return (
      <Box 
        bg="black" 
        minHeight="100vh" 
        width="100vw" 
        overflow="hidden"
        backgroundImage={`url(${splashBg})`}
        backgroundSize="cover"
        backgroundPosition="center"
        backgroundRepeat="no-repeat"
      >
        <Box 
          width="100%"
          height="100vh"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Box
            animation={`${pulseAnimation} 2s ease-in-out infinite`}
          >
            <KeepKeyUiGlyph 
              width="100px" 
              height="100px" 
              color="#FFD700"
            />
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box bg="black" minHeight="100vh" width="100vw" overflow="hidden">
      {/* Add structured data for SEO */}
      <ProductStructuredData />
      <OrganizationStructuredData />
      <SoftwareApplicationStructuredData />
      
      <Box 
        width="100%"
        height="100vh"
        bg="black" 
        overflow="hidden"
        position="relative"
        backgroundImage={`url(${splashBg})`}
        backgroundSize="cover"
        backgroundPosition="center"
        backgroundRepeat="no-repeat"
      >
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          opacity={showLoading ? 1 : 0}
          display={showLoading ? 'flex' : 'none'}
          justifyContent="center"
          alignItems="center"
          backgroundImage={`url(${splashBg})`}
          backgroundSize="cover"
          backgroundPosition="center"
          backgroundRepeat="no-repeat"
          zIndex={999}
          transition="opacity 0.3s ease"
        >
          <Box
            animation={`${pulseAnimation} 2s ease-in-out infinite`}
          >
            <KeepKeyUiGlyph 
              width="100px" 
              height="100px" 
              color="#FFD700"
            />
          </Box>
        </Box>

        <Box
          opacity={showLoading ? 0 : 1}
          transform={showLoading ? 'scale(0.98)' : 'scale(1)'}
          transition="all 0.3s ease"
          height="100%"
        >
          <Dashboard 
            onSettingsClick={() => setIsSettingsOpen(true)}
            onAddNetworkClick={() => setIsAddBlockchainOpen(true)}
          />
        </Box>
      </Box>

      {/* Settings Dialog */}
      {/* @ts-ignore */}
      <DialogRoot open={isSettingsOpen} onOpenChange={handleSettingsOpenChange}>
        {/* @ts-ignore */}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Settings onClose={() => setIsSettingsOpen(false)} />
          </DialogBody>
          <DialogFooter>
            {/* @ts-ignore */}
            <DialogCloseTrigger asChild>
              <Box as="button" color="white" p={2} fontSize="sm">
                Close
              </Box>
            </DialogCloseTrigger>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Add Blockchain Dialog */}
      {/* @ts-ignore */}
      <DialogRoot open={isAddBlockchainOpen} onOpenChange={handleAddBlockchainOpenChange}>
        {/* @ts-ignore */}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Blockchain</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <AddBlockchain onClose={() => setIsAddBlockchainOpen(false)} />
          </DialogBody>
          <DialogFooter>
            {/* @ts-ignore */}
            <DialogCloseTrigger asChild>
              <Box as="button" color="white" p={2} fontSize="sm">
                Close
              </Box>
            </DialogCloseTrigger>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </Box>
  );
}
