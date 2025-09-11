'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  IconButton,
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
import { FaDownload, FaPlus, FaMinus } from 'react-icons/fa';
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
  const [reportOptions, setReportOptions] = useState<ReportOptions>({});
  const [generator, setGenerator] = useState<any>(null);
  const [networkType, setNetworkType] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');

  // Initialize report generator when dialog opens or asset changes
  useEffect(() => {
    if (isOpen && assetContext) {
      const gen = ReportGeneratorFactory.getGenerator(assetContext);
      setGenerator(gen);
      setReportOptions(gen.getDefaultOptions());
      setNetworkType(ReportGeneratorFactory.getNetworkType(assetContext));
      setReportDescription(ReportGeneratorFactory.getReportDescription(assetContext));
    }
  }, [isOpen, assetContext]);

  const handleAccountCountChange = (delta: number) => {
    const currentCount = reportOptions.accountCount || 1;
    const newCount = currentCount + delta;
    if (newCount >= 1 && newCount <= 20) {
      setReportOptions({ ...reportOptions, accountCount: newCount });
    }
  };

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

  // Determine if account selector should be shown
  const showAccountSelector = networkType === 'UTXO' || 
                              (networkType === 'EVM' && (reportOptions.accountCount || 1) > 1);

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogContent bg={theme.cardBg} borderColor={theme.border}>
        <DialogHeader>
          <DialogTitle color={theme.gold}>
            Generate {networkType} Report
          </DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        
        <DialogBody>
          <VStack gap={6} align="stretch">
            {/* Asset Information */}
            <Box>
              <Text fontSize="sm" color="gray.400" mb={2}>Asset</Text>
              <Text fontSize="lg" color="white">
                {assetContext?.symbol || 'Unknown'} ({assetContext?.name || 'Unknown Asset'})
              </Text>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Network: {assetContext?.networkId || 'Unknown'}
              </Text>
            </Box>

            {/* Report Type Description */}
            <Box>
              <Text fontSize="sm" color="gray.400" mb={2}>Report Type</Text>
              <Text fontSize="sm" color="gray.300">
                {reportDescription}
              </Text>
            </Box>

            {/* Account Count Selector (for UTXO and multi-account chains) */}
            {showAccountSelector && (
              <Box>
                <Text fontSize="sm" color="gray.400" mb={2}>
                  {networkType === 'UTXO' ? 'Number of Accounts' : 'Number of Addresses'}
                </Text>
                <HStack>
                  <IconButton
                    aria-label="Decrease"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAccountCountChange(-1)}
                    isDisabled={(reportOptions.accountCount || 1) <= 1 || loading}
                  >
                    <FaMinus />
                  </IconButton>
                  <Box 
                    px={4} 
                    py={2} 
                    bg={theme.bg} 
                    borderRadius="md" 
                    borderWidth="1px"
                    borderColor={theme.border}
                    minW="60px"
                    textAlign="center"
                  >
                    <Text color="white">{reportOptions.accountCount || 1}</Text>
                  </Box>
                  <IconButton
                    aria-label="Increase"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAccountCountChange(1)}
                    isDisabled={(reportOptions.accountCount || 1) >= 20 || loading}
                  >
                    <FaPlus />
                  </IconButton>
                </HStack>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {networkType === 'UTXO' 
                    ? `Will generate XPUBs for accounts 0 through ${(reportOptions.accountCount || 1) - 1}`
                    : `Will include ${reportOptions.accountCount || 1} addresses in the report`
                  }
                </Text>
              </Box>
            )}

            {/* Report Contents Preview */}
            <Box>
              <Text fontSize="sm" color="gray.400" mb={2}>Report Contents</Text>
              <VStack align="start" gap={1}>
                {networkType === 'UTXO' && (
                  <>
                    <Text fontSize="sm" color="gray.300">• All XPUB types (Legacy, SegWit, Native SegWit)</Text>
                    <Text fontSize="sm" color="gray.300">• Derivation paths for each account</Text>
                    <Text fontSize="sm" color="gray.300">• Current receive and change indices</Text>
                    <Text fontSize="sm" color="gray.300">• Balance and transaction history</Text>
                  </>
                )}
                {networkType === 'EVM' && (
                  <>
                    <Text fontSize="sm" color="gray.300">• Account addresses and balances</Text>
                    <Text fontSize="sm" color="gray.300">• Token holdings and values</Text>
                    <Text fontSize="sm" color="gray.300">• Transaction counts and nonces</Text>
                    <Text fontSize="sm" color="gray.300">• Network and chain information</Text>
                  </>
                )}
                {networkType === 'Cosmos' && (
                  <>
                    <Text fontSize="sm" color="gray.300">• Account balances and addresses</Text>
                    <Text fontSize="sm" color="gray.300">• Staking delegations and validators</Text>
                    <Text fontSize="sm" color="gray.300">• Pending rewards and unbonding</Text>
                    <Text fontSize="sm" color="gray.300">• Total portfolio value</Text>
                  </>
                )}
                {!['UTXO', 'EVM', 'Cosmos'].includes(networkType) && (
                  <>
                    <Text fontSize="sm" color="gray.300">• Account addresses</Text>
                    <Text fontSize="sm" color="gray.300">• Current balances</Text>
                    <Text fontSize="sm" color="gray.300">• Network information</Text>
                    <Text fontSize="sm" color="gray.300">• Asset details</Text>
                  </>
                )}
              </VStack>
            </Box>

            {/* Security Warning */}
            <Box bg="rgba(255, 215, 0, 0.1)" p={3} borderRadius="md" borderWidth="1px" borderColor={theme.gold}>
              <Text fontSize="sm" color={theme.gold}>
                ⚠️ This report will contain sensitive wallet information. Store it securely and never share with untrusted parties.
              </Text>
            </Box>
          </VStack>
        </DialogBody>

        <DialogFooter>
          <HStack gap={3}>
            <Button
              variant="outline"
              onClick={onClose}
              isDisabled={loading}
              borderColor={theme.border}
              color="gray.300"
              _hover={{ borderColor: theme.gold, color: theme.gold }}
            >
              Cancel
            </Button>
            <Button
              bg={theme.gold}
              color="black"
              _hover={{ bg: theme.goldHover }}
              onClick={generatePDFReport}
              isDisabled={loading || !generator}
              leftIcon={loading ? <Spinner size="sm" /> : <FaDownload />}
            >
              {loading ? 'Generating...' : 'Generate PDF Report'}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};