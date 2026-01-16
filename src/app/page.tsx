'use client'
// @ts-nocheck

import { Box, Flex } from "@chakra-ui/react"
import { keyframes } from '@emotion/react'
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph'
import Dashboard from '@/components/dashboard/Dashboard'
import { usePioneerContext } from '@/components/providers/pioneer'
import { useHeader } from '@/contexts/HeaderContext'
import { useState, useEffect, useRef } from 'react'
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
// TODO: Re-enable for custom networks feature
// import AddBlockchain from '@/components/blockchain/AddBlockchain'
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
  const { setActions } = useHeader();

  // Show loading state only when data is not ready
  const showLoading = !app?.dashboard;

  // 🚨 CRITICAL DEBUG - Why is dashboard missing?
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🟡 [PAGE.TSX] YELLOW LOGO STATUS');
    console.log('🟡 showLoading:', showLoading);
    console.log('🟡 pioneer:', !!pioneer);
    console.log('🟡 state:', !!state);
    console.log('🟡 app:', !!app);
    console.log('🟡 app.dashboard:', !!app?.dashboard);
    console.log('🟡 app.balances:', app?.balances?.length || 0);
    console.log('🟡 app.pubkeys:', app?.pubkeys?.length || 0);
    if (!app?.dashboard) {
      console.error('🚨 [PAGE.TSX] DASHBOARD IS MISSING - THIS IS WHY YELLOW LOGO IS STUCK!');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, [showLoading, pioneer, state, app]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dashboardRef = useRef(null);

  // Set header actions for dashboard
  useEffect(() => {
    setActions({
      onSettingsClick: () => setIsSettingsOpen(true),
      onRefreshClick: () => {
        // Trigger refresh on the Dashboard component
        if (dashboardRef.current && dashboardRef.current.handleRefresh) {
          dashboardRef.current.handleRefresh(true);
        }
      },
      isRefreshing,
    });
  }, [isRefreshing, setActions]);

  // Handle settings dialog open state
  const handleSettingsOpenChange = (details: { open: boolean }) => {
    setIsSettingsOpen(details.open);
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
            ref={dashboardRef}
            onRefreshStateChange={setIsRefreshing}
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
    </Box>
  );
}
