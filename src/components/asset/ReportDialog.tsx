'use client'

import React, { useState } from 'react';
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

// Dynamic imports for pdfmake to avoid SSR issues
let pdfMake: any = null;
if (typeof window !== 'undefined') {
  pdfMake = require('pdfmake/build/pdfmake');
  const pdfFonts = require('pdfmake/build/vfs_fonts');
  pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;
}

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

// XPUB types for Bitcoin
const XPUB_TYPES = [
  { name: 'Legacy', bip: 44, prefix: 'xpub' },
  { name: 'SegWit', bip: 49, prefix: 'ypub' },
  { name: 'Native SegWit', bip: 84, prefix: 'zpub' },
] as const;

export const ReportDialog: React.FC<ReportDialogProps> = ({ isOpen, onClose, assetContext }) => {
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  const [loading, setLoading] = useState(false);
  const [accountCount, setAccountCount] = useState(3); // Default to 3 accounts (0, 1, 2)

  // Check if this is Bitcoin or another UTXO coin
  const isBitcoin = assetContext?.networkId?.startsWith('bip122:');

  const handleAccountCountChange = (delta: number) => {
    const newCount = accountCount + delta;
    if (newCount >= 1 && newCount <= 20) {
      setAccountCount(newCount);
    }
  };

  // Helper function to convert BIP32 path to address_n array
  const bip32ToAddressNList = (path: string): number[] => {
    if (!path) return [];
    
    const parts = path.split('/').filter(p => p !== 'm');
    return parts.map(part => {
      const isHardened = part.includes("'");
      const num = parseInt(part.replace("'", ""));
      return isHardened ? 0x80000000 + num : num;
    });
  };

  const generatePDFReport = async () => {
    setLoading(true);
    
    try {
      if (!pdfMake) {
        console.error('pdfMake not loaded');
        return;
      }

      const reportData: any[] = [];
      const currentDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      if (isBitcoin) {
        // For Bitcoin, generate report for multiple accounts with all XPUB types
        for (let accountNum = 0; accountNum < accountCount; accountNum++) {
          
          // Generate all three types of XPUBs for this account
          for (const xpubType of XPUB_TYPES) {
            const xpubPath = `m/${xpubType.bip}'/0'/${accountNum}'`;
            
            let xpub = '';
            let receiveIndex = 0;
            let changeIndex = 0;
            let totalReceived = '0';
            let totalSent = '0';
            let balance = '0';
            let txCount = 0;
            
            // Get the actual XPUB from the KeepKey device
            if (app && app.keepKeySdk) {
              try {
                console.log(`Getting XPUB for path: ${xpubPath}`);
                
                // Convert path to address_n array for KeepKey SDK
                const addressNList = bip32ToAddressNList(xpubPath);
                
                // Determine the script type based on BIP standard
                const scriptType = xpubType.bip === 44 ? 'p2pkh' : 
                                 xpubType.bip === 49 ? 'p2sh-p2wpkh' : 
                                 'p2wpkh';
                
                const pathQuery = {
                  addressNList: addressNList,
                  address_n: addressNList,  // Include both for compatibility
                  coin: 'Bitcoin',          // Specify Bitcoin as the coin
                  script_type: scriptType,  // Add the appropriate script type
                  showDisplay: false,       // Don't show on device for bulk generation
                  show_display: false       // Include both for compatibility
                };
                
                console.log('Calling getPublicKey with params:', pathQuery);
                
                // Call the KeepKey SDK to get the public key (XPUB)
                const responsePubkey = await app.keepKeySdk.system.info.getPublicKey(pathQuery);
                
                if (responsePubkey && responsePubkey.xpub) {
                  xpub = responsePubkey.xpub;
                  console.log(`Got XPUB for account ${accountNum} (${xpubType.name}):`, xpub);
                } else {
                  console.error('No XPUB in response:', responsePubkey);
                  xpub = `NO_XPUB_RETURNED`;
                }
              } catch (e: any) {
                console.error(`Error fetching XPUB for path ${xpubPath}:`, e);
                xpub = `ERROR_FETCHING_XPUB`;
              }
            } else {
              // No KeepKey SDK available
              console.warn('KeepKey SDK not available');
              xpub = `NO_DEVICE_CONNECTED`;
            }
            
            // Try to get additional data from Pioneer API if available
            if (app && app.pioneer && app.pioneer.GetChangeAddress && xpub && !xpub.includes('ERROR') && !xpub.includes('NO_')) {
              try {
                console.log(`Getting address data from Pioneer API for XPUB`);
                
                const addressInfo = await app.pioneer.GetChangeAddress({
                  network: assetContext.symbol || 'BTC',
                  xpub: xpub
                });
                
                if (addressInfo && addressInfo.data && addressInfo.data.data) {
                  const actualData = addressInfo.data.data;
                  
                  changeIndex = actualData.changeIndex || 0;
                  receiveIndex = actualData.receiveIndex || 0;
                  
                  // Convert satoshis to BTC
                  if (actualData.totalReceived !== undefined) {
                    const satoshisReceived = Number(actualData.totalReceived || 0);
                    totalReceived = (satoshisReceived / 100000000).toFixed(8);
                  }
                  
                  if (actualData.totalSent !== undefined) {
                    const satoshisSent = Number(actualData.totalSent || 0);
                    totalSent = (satoshisSent / 100000000).toFixed(8);
                  }
                  
                  if (actualData.balance !== undefined) {
                    const satoshisBalance = Number(actualData.balance || 0);
                    balance = (satoshisBalance / 100000000).toFixed(8);
                  }
                  
                  txCount = actualData.txs || actualData.addrTxCount || 0;
                }
              } catch (e) {
                console.error('Error getting address data from Pioneer:', e);
              }
            }
            
            reportData.push({
              account: accountNum,
              type: xpubType.name,
              xpub: xpub,
              derivationPath: xpubPath,
              receiveIndex: receiveIndex,
              changeIndex: changeIndex,
              balance: balance,
              totalReceived: totalReceived,
              totalSent: totalSent,
              txCount: txCount
            });
          }
        }
      }

      // Create PDF document
      const docDefinition = {
        pageSize: 'LETTER',
        pageOrientation: 'landscape' as const,
        pageMargins: [40, 60, 40, 60] as [number, number, number, number],
        content: [
          {
            text: 'KeepKey Wallet XPUB Report',
            style: 'header',
            alignment: 'center' as const,
            margin: [0, 0, 0, 10] as [number, number, number, number]
          },
          {
            text: `Generated on ${currentDate}`,
            style: 'subheader',
            alignment: 'center' as const,
            margin: [0, 0, 0, 20] as [number, number, number, number]
          },
          {
            text: `Asset: ${assetContext?.symbol || 'Bitcoin'}`,
            style: 'info',
            margin: [0, 0, 0, 20] as [number, number, number, number]
          },
          {
            table: {
              headerRows: 1,
              widths: ['auto', 'auto', '40%', 'auto', 'auto', 'auto', 'auto', 'auto'],
              body: [
                // Header row
                [
                  { text: 'Account', style: 'tableHeader' },
                  { text: 'Type', style: 'tableHeader' },
                  { text: 'XPUB', style: 'tableHeader' },
                  { text: 'Path', style: 'tableHeader' },
                  { text: 'Receive Idx', style: 'tableHeader' },
                  { text: 'Change Idx', style: 'tableHeader' },
                  { text: 'Balance (BTC)', style: 'tableHeader' },
                  { text: 'TX Count', style: 'tableHeader' }
                ],
                // Data rows
                ...reportData.map(row => [
                  row.account.toString(),
                  row.type,
                  { text: row.xpub, fontSize: 7 },
                  { text: row.derivationPath, fontSize: 8 },
                  row.receiveIndex.toString(),
                  row.changeIndex.toString(),
                  row.balance,
                  row.txCount.toString()
                ])
              ]
            },
            layout: {
              fillColor: function (rowIndex: number) {
                return (rowIndex % 2 === 0) ? '#f0f0f0' : null;
              }
            }
          },
          {
            text: '\n\nSummary Statistics',
            style: 'sectionHeader',
            margin: [0, 20, 0, 10] as [number, number, number, number]
          },
          {
            ul: [
              `Total Accounts Analyzed: ${accountCount}`,
              `XPUB Types per Account: 3 (Legacy, SegWit, Native SegWit)`,
              `Total XPUBs Generated: ${reportData.length}`,
              `Total Balance: ${reportData.reduce((sum, row) => sum + parseFloat(row.balance || '0'), 0).toFixed(8)} BTC`,
              `Total Transactions: ${reportData.reduce((sum, row) => sum + row.txCount, 0)}`
            ],
            style: 'summary'
          },
          {
            text: '\n\nImportant Notes',
            style: 'sectionHeader',
            margin: [0, 20, 0, 10] as [number, number, number, number]
          },
          {
            ul: [
              'This report contains sensitive information. Store securely.',
              'XPUBs can be used to view all addresses and balances for an account.',
              'Never share XPUBs with untrusted parties.',
              'Receive Index indicates the next unused receiving address.',
              'Change Index indicates the next unused change address.'
            ],
            style: 'notes',
            color: '#666666'
          }
        ],
        styles: {
          header: {
            fontSize: 22,
            bold: true,
            color: '#333333'
          },
          subheader: {
            fontSize: 14,
            color: '#666666'
          },
          info: {
            fontSize: 12,
            bold: true
          },
          sectionHeader: {
            fontSize: 16,
            bold: true,
            color: '#333333'
          },
          tableHeader: {
            bold: true,
            fontSize: 10,
            color: '#000000',
            fillColor: '#FFD700'
          },
          summary: {
            fontSize: 11,
            margin: [20, 0, 0, 0] as [number, number, number, number]
          },
          notes: {
            fontSize: 10,
            italics: true,
            margin: [20, 0, 0, 0] as [number, number, number, number]
          }
        },
        footer: function(currentPage: number, pageCount: number) {
          return {
            text: `Page ${currentPage} of ${pageCount}`,
            alignment: 'center' as const,
            fontSize: 9,
            color: '#999999',
            margin: [0, 30, 0, 0] as [number, number, number, number]
          };
        }
      };

      // Generate and download the PDF
      const filename = `${assetContext?.symbol || 'BTC'}_xpub_report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdfMake.createPdf(docDefinition).download(filename);
      
      console.log('PDF report generated successfully');
      onClose();
    } catch (error) {
      console.error('Error generating PDF report:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogContent bg={theme.cardBg} borderColor={theme.border}>
        <DialogHeader>
          <DialogTitle color={theme.gold}>Generate XPUB Report</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        
        <DialogBody>
          <VStack gap={6} align="stretch">
            {/* Asset Information */}
            <Box>
              <Text fontSize="sm" color="gray.400" mb={2}>Asset</Text>
              <Text fontSize="lg" color="white">
                {assetContext?.symbol || 'Bitcoin'} ({assetContext?.name || 'Bitcoin'})
              </Text>
            </Box>

            {/* Account Count Selector */}
            {isBitcoin && (
              <Box>
                <Text fontSize="sm" color="gray.400" mb={2}>Number of Accounts to Include</Text>
                <HStack>
                  <IconButton
                    aria-label="Decrease accounts"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAccountCountChange(-1)}
                    isDisabled={accountCount <= 1 || loading}
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
                    <Text color="white">{accountCount}</Text>
                  </Box>
                  <IconButton
                    aria-label="Increase accounts"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAccountCountChange(1)}
                    isDisabled={accountCount >= 20 || loading}
                  >
                    <FaPlus />
                  </IconButton>
                </HStack>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Will generate XPUBs for accounts 0 through {accountCount - 1}
                </Text>
              </Box>
            )}

            {/* Report Information */}
            <Box>
              <Text fontSize="sm" color="gray.400" mb={2}>Report Contents</Text>
              <VStack align="start" gap={1}>
                <Text fontSize="sm" color="gray.300">• All XPUB types (Legacy, SegWit, Native SegWit)</Text>
                <Text fontSize="sm" color="gray.300">• Derivation paths for each account</Text>
                <Text fontSize="sm" color="gray.300">• Current receive and change indices</Text>
                <Text fontSize="sm" color="gray.300">• Balance and transaction history</Text>
              </VStack>
            </Box>

            {/* Warning Message */}
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
              isDisabled={loading || !isBitcoin}
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