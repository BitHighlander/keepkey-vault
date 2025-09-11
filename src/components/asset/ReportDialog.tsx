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

            {/* Report Type Description */}
            <Box 
              p={4} 
              bg="rgba(255, 215, 0, 0.05)" 
              borderRadius="xl" 
              borderWidth="1px" 
              borderColor="rgba(255, 215, 0, 0.2)"
            >
              <Text color={theme.gold} fontSize="xs" fontWeight="medium" mb={2}>
                Report Type
              </Text>
              <Text color="gray.400" fontSize="xs">
                {reportDescription}
              </Text>
            </Box>

            {/* Account Count Selector (for UTXO and multi-account chains) */}
            {showAccountSelector && (
              <Box 
                p={6} 
                bg={theme.bg} 
                borderRadius="xl" 
                borderWidth="1px" 
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={4} fontWeight="medium">
                  {networkType === 'UTXO' ? 'Number of Accounts' : 'Number of Addresses'}
                </Text>
                <HStack justify="space-between" align="center" gap={6}>
                  <IconButton
                    onClick={() => handleAccountCountChange(-1)}
                    disabled={(reportOptions.accountCount || 1) <= 1 || loading}
                    size="md"
                    bg={theme.border}
                    color="white"
                    borderRadius="lg"
                    _hover={{ bg: theme.borderLight }}
                    _disabled={{ opacity: 0.3, cursor: 'not-allowed' }}
                    width="50px"
                    height="50px"
                    aria-label="Decrease"
                  >
                    <FaMinus />
                  </IconButton>
                  
                  <Box textAlign="center" flex={1}>
                    <Text color="white" fontSize="3xl" fontWeight="bold">
                      {reportOptions.accountCount || 1}
                    </Text>
                    <Text color="gray.500" fontSize="sm" mt={1}>
                      {networkType === 'UTXO' 
                        ? `Accounts 0-${(reportOptions.accountCount || 1) - 1}`
                        : `${reportOptions.accountCount || 1} addresses`
                      }
                    </Text>
                  </Box>
                  
                  <IconButton
                    onClick={() => handleAccountCountChange(1)}
                    disabled={(reportOptions.accountCount || 1) >= 20 || loading}
                    size="md"
                    bg={theme.border}
                    color="white"
                    borderRadius="lg"
                    _hover={{ bg: theme.borderLight }}
                    _disabled={{ opacity: 0.3, cursor: 'not-allowed' }}
                    width="50px"
                    height="50px"
                    aria-label="Increase"
                  >
                    <FaPlus />
                  </IconButton>
                </HStack>
                
                {networkType === 'UTXO' && (
                  <Box mt={4} p={3} bg="rgba(255, 215, 0, 0.05)" borderRadius="lg">
                    <Text color="gray.400" fontSize="xs">
                      • 3 XPUB types per account (Legacy, SegWit, Native SegWit)
                    </Text>
                    <Text color="gray.400" fontSize="xs">
                      • Total of {(reportOptions.accountCount || 1) * 3} XPUBs in report
                    </Text>
                  </Box>
                )}
              </Box>
            )}

            {/* Report Contents Preview */}
            <Box 
              p={6} 
              bg={theme.bg} 
              borderRadius="xl" 
              borderWidth="1px" 
              borderColor={theme.border}
            >
              <Text color="gray.400" fontSize="sm" mb={4} fontWeight="medium">
                Report Contents
              </Text>
              <VStack align="start" gap={2}>
                {networkType === 'UTXO' && (
                  <>
                    <Text color="gray.400" fontSize="xs">• All XPUB types (Legacy, SegWit, Native SegWit)</Text>
                    <Text color="gray.400" fontSize="xs">• Derivation paths for each account</Text>
                    <Text color="gray.400" fontSize="xs">• Current receive and change indices</Text>
                    <Text color="gray.400" fontSize="xs">• Balance and transaction history</Text>
                  </>
                )}
                {networkType === 'EVM' && (
                  <>
                    <Text color="gray.400" fontSize="xs">• Account addresses and balances</Text>
                    <Text color="gray.400" fontSize="xs">• Token holdings and values</Text>
                    <Text color="gray.400" fontSize="xs">• Transaction counts and nonces</Text>
                    <Text color="gray.400" fontSize="xs">• Network and chain information</Text>
                  </>
                )}
                {networkType === 'Cosmos' && (
                  <>
                    <Text color="gray.400" fontSize="xs">• Account balances and addresses</Text>
                    <Text color="gray.400" fontSize="xs">• Staking delegations and validators</Text>
                    <Text color="gray.400" fontSize="xs">• Pending rewards and unbonding</Text>
                    <Text color="gray.400" fontSize="xs">• Total portfolio value</Text>
                  </>
                )}
                {!['UTXO', 'EVM', 'Cosmos'].includes(networkType) && (
                  <>
                    <Text color="gray.400" fontSize="xs">• Account addresses</Text>
                    <Text color="gray.400" fontSize="xs">• Current balances</Text>
                    <Text color="gray.400" fontSize="xs">• Network information</Text>
                    <Text color="gray.400" fontSize="xs">• Asset details</Text>
                  </>
                )}
              </VStack>
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