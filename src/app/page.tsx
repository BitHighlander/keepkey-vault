'use client'

import { Box, Flex, Spinner } from "@chakra-ui/react"
import Dashboard from '@/components/dashboard/Dashboard'
import Asset from '@/components/asset/Asset'
import { usePioneerContext } from '@/components/providers/pioneer'
import { useState, useEffect } from 'react'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  type OpenChangeDetails,
} from "@/components/ui/dialog"
import Settings from '@/components/settings/Settings'
import AddBlockchain from '@/components/blockchain/AddBlockchain'

export default function Home() {
  const { 
    app, 
    isTransitioning, 
    currentView,
    handleViewTransition 
  } = usePioneerContext();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddBlockchainOpen, setIsAddBlockchainOpen] = useState(false);

  // Add debug logging for component mount and state changes
  useEffect(() => {
    console.log('🏠 [Page] Component mounted');
    return () => console.log('🏠 [Page] Component unmounting');
  }, []);

  useEffect(() => {
    console.log('🔄 [Page] State update:', {
      currentView,
      isTransitioning,
      hasAssetContext: !!app?.assetContext
    });
  }, [currentView, isTransitioning, app?.assetContext]);

  const handleSettingsOpenChange = (details: OpenChangeDetails) => {
    setIsSettingsOpen(details.open);
  };

  const handleAddBlockchainOpenChange = (details: OpenChangeDetails) => {
    setIsAddBlockchainOpen(details.open);
  };

  return (
    <Flex 
      minH="100vh" 
      justify="center" 
      align="center" 
      bg="black"
    >
      <Box 
        width="375px" 
        height="600px"
        bg="black" 
        overflow="hidden"
        position="relative"
        boxShadow="xl"
        borderRadius="2xl"
        border="1px solid"
        borderColor="gray.800"
      >
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          opacity={isTransitioning ? 1 : 0}
          display={isTransitioning ? 'flex' : 'none'}
          justifyContent="center"
          alignItems="center"
          bg="rgba(0,0,0,0.8)"
          zIndex={999}
          transition="opacity 0.3s ease"
        >
          <Spinner 
            size="xl"
            color="gold"
          />
        </Box>

        <Box
          opacity={isTransitioning ? 0 : 1}
          transform={isTransitioning ? 'scale(0.98)' : 'scale(1)'}
          transition="all 0.3s ease"
        >
          {currentView === 'asset' ? (
            <Asset key={`asset-${app?.assetContext?.networkId}`} />
          ) : (
            <Dashboard 
              key={`dashboard-${Date.now()}`}
              onSettingsClick={() => setIsSettingsOpen(true)}
              onAddNetworkClick={() => setIsAddBlockchainOpen(true)}
            />
          )}
        </Box>
      </Box>

      {/* Settings Dialog */}
      <DialogRoot 
        open={isSettingsOpen} 
        onOpenChange={handleSettingsOpenChange}
        modal={true}
        size="md"
      >
        <DialogContent
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '400px'
          }}
        >
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Settings onClose={() => setIsSettingsOpen(false)} />
          </DialogBody>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>

      {/* Add Blockchain Dialog */}
      <DialogRoot 
        open={isAddBlockchainOpen} 
        onOpenChange={handleAddBlockchainOpenChange}
        modal={true}
        size="lg"
      >
        <DialogContent
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <DialogHeader>
            <DialogTitle>Add Network</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <AddBlockchain onClose={() => setIsAddBlockchainOpen(false)} />
          </DialogBody>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>
    </Flex>
  )
}
