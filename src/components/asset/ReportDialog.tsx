'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Spinner,
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { FaDownload } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';
import { ReportGeneratorFactory, ReportOptions } from './reportGenerators';

// Theme colors - matching the project theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
  borderLight: '#333333',
};

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assetContext: any;
}

export const ReportDialog: React.FC<ReportDialogProps> = ({ isOpen, onClose, assetContext }) => {
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  const [loading, setLoading] = useState(false);
  const [generator, setGenerator] = useState<any>(null);
  const [networkType, setNetworkType] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');

  // Hard-coded options: LOD 5, 5 accounts
  const reportOptions: ReportOptions = {
    accountCount: 5,
    lodLevel: 5,
    lod: 5,
    includeTransactions: true,
    includeAddresses: true
  };

  // Initialize report generator when dialog opens or asset changes
  useEffect(() => {
    if (isOpen && assetContext) {
      const gen = ReportGeneratorFactory.getGenerator(assetContext);
      setGenerator(gen);
      setNetworkType(ReportGeneratorFactory.getNetworkType(assetContext));
      setReportDescription(ReportGeneratorFactory.getReportDescription(assetContext));
    }
  }, [isOpen, assetContext]);

  const generatePDFReport = async () => {
    if (!generator) {
      console.error('No report generator available');
      return;
    }

    setLoading(true);
    
    try {
      // Generate the report data using the appropriate generator
      const reportData = await generator.generateReport(assetContext, app, reportOptions);
      
      // Generate and download the PDF
      await generator.generatePDF(reportData);
      
      console.log(`${networkType} report generated successfully`);
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent 
        bg={theme.cardBg} 
        borderColor={theme.gold} 
        borderWidth="2px"
        borderRadius="xl"
        maxW="500px"
        p={8}
      >
        <DialogHeader borderBottom={`1px solid ${theme.border}`} pb={6} mb={6}>
          <DialogTitle color={theme.gold} fontSize="2xl" fontWeight="bold">
            Generate {networkType} Report
          </DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        
        <DialogBody pt={0} pb={6}>
          <VStack gap={8} align="stretch">
            {/* Asset Information Box */}
            <Box 
              p={6} 
              bg={theme.bg} 
              borderRadius="xl" 
              borderWidth="1px" 
              borderColor={theme.border}
            >
              <Text color="gray.400" fontSize="sm" mb={2} fontWeight="medium">
                Asset
              </Text>
              <Text color="white" fontSize="lg" fontWeight="bold">
                {assetContext?.symbol || 'Unknown'} ({assetContext?.name || 'Unknown Asset'})
              </Text>
              <Text color="gray.500" fontSize="xs" mt={1}>
                Network: {assetContext?.networkId || 'Unknown'}
              </Text>
            </Box>

            {/* Report Settings Info */}
            <Box
              p={4}
              bg="rgba(255, 215, 0, 0.05)"
              borderRadius="xl"
              borderWidth="1px"
              borderColor="rgba(255, 215, 0, 0.2)"
            >
              <Text color={theme.gold} fontSize="xs" fontWeight="medium" mb={2}>
                Report Configuration
              </Text>
              <Text color="gray.400" fontSize="xs">
                {reportDescription}
              </Text>
              <Text color="gray.400" fontSize="xs" mt={2}>
                • Level of Detail: 5 (Maximum detail with full transaction history)
              </Text>
              <Text color="gray.400" fontSize="xs">
                • Accounts: 5 {networkType === 'UTXO' ? '(15 XPUBs total)' : 'addresses'}
              </Text>
            </Box>

            {/* Security Warning */}
            <Box 
              p={4} 
              bg="rgba(255, 215, 0, 0.1)" 
              borderRadius="xl" 
              borderWidth="1px" 
              borderColor={theme.gold}
            >
              <Text color={theme.gold} fontSize="sm" fontWeight="medium">
                ⚠️ Security Notice
              </Text>
              <Text color={theme.gold} fontSize="xs" mt={2} opacity={0.9}>
                This report will contain sensitive wallet information. Store it securely and never share with untrusted parties.
              </Text>
            </Box>
          </VStack>
        </DialogBody>

        <DialogFooter borderTop={`1px solid ${theme.border}`} pt={6}>
          <HStack gap={4} width="100%">
            <Button 
              flex={1}
              size="lg"
              height="56px"
              variant="ghost" 
              onClick={onClose} 
              color="gray.400"
              _hover={{ bg: theme.border }}
              borderRadius="lg"
            >
              Cancel
            </Button>
            <Button
              flex={2}
              size="lg"
              height="56px"
              onClick={generatePDFReport}
              disabled={loading || !generator}
              bg={theme.gold}
              color="black"
              _hover={{ bg: theme.goldHover }}
              borderRadius="lg"
              fontWeight="bold"
            >
              {loading ? (
                <HStack gap={3}>
                  <Spinner size="sm" color="black" />
                  <Text>Generating...</Text>
                </HStack>
              ) : (
                <HStack gap={3}>
                  <FaDownload />
                  <Text>Generate PDF Report</Text>
                </HStack>
              )}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};