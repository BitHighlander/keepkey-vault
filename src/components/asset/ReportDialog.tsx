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
  Input,
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
import { toaster } from '@/components/ui/toaster';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { XPUB_TYPES, bip32ToAddressNList } from '@/types/balance';

// Configure pdfMake fonts
if (typeof window !== 'undefined') {
  pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;
}

// Theme colors
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
  pubkeys?: any[];
  balances?: any[];
}

interface ReportOptions {
  accountCount: number;
  filename: string;
}

export const ReportDialog: React.FC<ReportDialogProps> = ({ 
  isOpen, 
  onClose, 
  assetContext,
  pubkeys = [],
  balances = []
}) => {
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  const [loading, setLoading] = useState(false);
  const [reportOptions, setReportOptions] = useState<ReportOptions>({
    accountCount: 3,
    filename: `${assetContext?.symbol || 'asset'}_xpub_report_${new Date().toISOString().split('T')[0]}`,
  });

  // Check if this is Bitcoin or another UTXO coin
  const isBitcoin = assetContext?.networkId?.startsWith('bip122:');

  const handleAccountCountChange = (delta: number) => {
    const newCount = reportOptions.accountCount + delta;
    if (newCount >= 1 && newCount <= 20) {
      setReportOptions({ ...reportOptions, accountCount: newCount });
    }
  };

  const generateAndDownloadPDF = async () => {
    setLoading(true);
    
    try {
      const data: any[] = [];
      
      if (isBitcoin) {
        // For Bitcoin, generate XPUBs for multiple accounts
        for (let accountNum = 0; accountNum < reportOptions.accountCount; accountNum++) {
          for (const xpubType of XPUB_TYPES) {
            const xpubPath = `m/${xpubType.bip}'/0'/${accountNum}'`;
            let xpub = '';
            
            // Get XPUB from device if available
            if (app?.keepKeySdk) {
              try {
                const addressNList = bip32ToAddressNList(xpubPath);
                const pathQuery = {
                  addressNList,
                  address_n: addressNList,
                  coin: 'Bitcoin',
                  script_type: xpubType.scriptType,
                  showDisplay: false,
                  show_display: false
                };
                
                const response = await app.keepKeySdk.system.info.getPublicKey(pathQuery);
                if (response?.xpub) {
                  xpub = response.xpub;
                }
              } catch (e) {
                console.error(`Error fetching XPUB for ${xpubPath}:`, e);
                xpub = `ERROR_FETCHING_${xpubType.prefix}_${accountNum}`;
              }
            } else {
              xpub = `NO_DEVICE_${xpubType.prefix}_${accountNum}`;
            }

            // Get balance if available
            const matchingBalance = balances.find((b: any) => 
              b.path === xpubPath || b.type === xpubType.name
            );
            
            data.push({
              account: accountNum,
              type: xpubType.name,
              path: xpubPath,
              xpub: xpub,
              balance: matchingBalance?.balance || '0',
              valueUsd: matchingBalance?.valueUsd || 0,
            });
          }
        }
      } else {
        // For non-Bitcoin assets, use existing pubkeys
        pubkeys.forEach((pubkey, index) => {
          const matchingBalance = balances.find((b: any) => 
            b.address === pubkey.address || 
            b.pubkey === pubkey.pubkey
          );

          data.push({
            account: index,
            type: pubkey.type || 'Standard',
            path: pubkey.path || '',
            address: pubkey.address,
            pubkey: pubkey.pubkey,
            balance: matchingBalance?.balance || '0',
            valueUsd: matchingBalance?.valueUsd || 0,
          });
        });
      }

      // Generate PDF document with better formatting
      const tableBody = [];
      
      // Add headers
      if (isBitcoin) {
        tableBody.push([
          { text: 'Account', bold: true, fontSize: 10 },
          { text: 'Type', bold: true, fontSize: 10 },
          { text: 'Path', bold: true, fontSize: 10 },
          { text: 'XPUB', bold: true, fontSize: 10 },
          { text: 'Balance', bold: true, fontSize: 10 },
          { text: 'Value (USD)', bold: true, fontSize: 10 }
        ]);
      } else {
        tableBody.push([
          { text: 'Account', bold: true, fontSize: 10 },
          { text: 'Type', bold: true, fontSize: 10 },
          { text: 'Address', bold: true, fontSize: 10 },
          { text: 'Balance', bold: true, fontSize: 10 },
          { text: 'Value (USD)', bold: true, fontSize: 10 }
        ]);
      }
      
      // Add data rows
      data.forEach(item => {
        if (isBitcoin) {
          tableBody.push([
            { text: item.account.toString(), fontSize: 9 },
            { text: item.type, fontSize: 9 },
            { text: item.path, fontSize: 8 },
            { text: item.xpub, fontSize: 7 }, // Small font for long XPUBs
            { text: `${item.balance} ${assetContext.symbol}`, fontSize: 9 },
            { text: `$${item.valueUsd.toFixed(2)}`, fontSize: 9 }
          ]);
        } else {
          tableBody.push([
            { text: item.account.toString(), fontSize: 9 },
            { text: item.type, fontSize: 9 },
            { text: item.address || item.pubkey || '', fontSize: 8 },
            { text: `${item.balance} ${assetContext.symbol}`, fontSize: 9 },
            { text: `$${item.valueUsd.toFixed(2)}`, fontSize: 9 }
          ]);
        }
      });

      const docDefinition: any = {
        content: [
          {
            text: `${assetContext.name} (${assetContext.symbol}) Account Report`,
            style: 'header',
            alignment: 'center',
            margin: [0, 0, 0, 20]
          },
          {
            text: `Generated: ${new Date().toLocaleString()}`,
            fontSize: 10,
            alignment: 'center',
            color: '#666666',
            margin: [0, 0, 0, 10]
          },
          {
            text: `Network: ${assetContext.networkId}`,
            fontSize: 10,
            alignment: 'center',
            color: '#666666',
            margin: [0, 0, 0, 20]
          },
          {
            table: {
              headerRows: 1,
              widths: isBitcoin 
                ? ['auto', 'auto', 'auto', '*', 'auto', 'auto'] 
                : ['auto', 'auto', '*', 'auto', 'auto'],
              body: tableBody
            },
            layout: {
              fillColor: function (rowIndex: number) {
                return (rowIndex === 0) ? '#EEEEEE' : null;
              },
              hLineWidth: function (i: number, node: any) {
                return (i === 0 || i === node.table.body.length) ? 1 : 0.5;
              },
              vLineWidth: function () {
                return 0.5;
              },
              hLineColor: function () {
                return '#DDDDDD';
              },
              vLineColor: function () {
                return '#DDDDDD';
              },
              paddingLeft: function() { return 4; },
              paddingRight: function() { return 4; },
              paddingTop: function() { return 2; },
              paddingBottom: function() { return 2; },
            }
          },
          {
            text: '\n\nSummary',
            fontSize: 12,
            bold: true,
            margin: [0, 10, 0, 10]
          },
          {
            columns: [
              {
                width: '*',
                text: [
                  { text: 'Total Accounts: ', bold: true, fontSize: 10 },
                  { text: data.length.toString(), fontSize: 10 }
                ]
              },
              {
                width: '*',
                text: [
                  { text: 'Total Balance: ', bold: true, fontSize: 10 },
                  { text: `${data.reduce((sum, item) => sum + parseFloat(item.balance), 0).toFixed(8)} ${assetContext.symbol}`, fontSize: 10 }
                ]
              },
              {
                width: '*',
                text: [
                  { text: 'Total Value: ', bold: true, fontSize: 10 },
                  { text: `$${data.reduce((sum, item) => sum + item.valueUsd, 0).toFixed(2)}`, fontSize: 10 }
                ]
              }
            ]
          }
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            color: '#333333'
          }
        },
        pageSize: 'A4',
        pageOrientation: isBitcoin ? 'landscape' : 'portrait',
        pageMargins: [40, 60, 40, 60]
      };

      // Generate and download PDF
      pdfMake.createPdf(docDefinition).download(`${reportOptions.filename}.pdf`);
      
      toaster.create({
        title: 'Report exported',
        description: 'PDF report downloaded successfully',
        type: 'success',
      });
      
      onClose();
    } catch (error) {
      console.error('Error generating PDF:', error);
      toaster.create({
        title: 'Export failed',
        description: 'Could not generate PDF report',
        type: 'error',
      });
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
        p={6}
      >
        <DialogHeader borderBottom={`1px solid ${theme.border}`} pb={4} mb={4}>
          <DialogTitle color={theme.gold} fontSize="xl" fontWeight="bold">
            Generate XPUB Report
          </DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        
        <DialogBody pt={0} pb={4}>
          <VStack gap={4} align="stretch">
            {isBitcoin && (
              <Box 
                p={4} 
                bg={theme.bg} 
                borderRadius="lg" 
                borderWidth="1px" 
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  Number of Accounts
                </Text>
                <HStack justify="space-between" align="center">
                  <IconButton
                    aria-label="Decrease accounts"
                    icon={<FaMinus />}
                    onClick={() => handleAccountCountChange(-1)}
                    isDisabled={reportOptions.accountCount <= 1}
                    size="sm"
                    bg={theme.border}
                    color="white"
                    borderRadius="md"
                    _hover={{ bg: theme.borderLight }}
                    _disabled={{ opacity: 0.3, cursor: 'not-allowed' }}
                  />
                  
                  <Box textAlign="center" flex={1}>
                    <Text color="white" fontSize="2xl" fontWeight="bold">
                      {reportOptions.accountCount}
                    </Text>
                    <Text color="gray.500" fontSize="xs">
                      account{reportOptions.accountCount > 1 ? 's' : ''}
                    </Text>
                  </Box>
                  
                  <IconButton
                    aria-label="Increase accounts"
                    icon={<FaPlus />}
                    onClick={() => handleAccountCountChange(1)}
                    isDisabled={reportOptions.accountCount >= 20}
                    size="sm"
                    bg={theme.border}
                    color="white"
                    borderRadius="md"
                    _hover={{ bg: theme.borderLight }}
                    _disabled={{ opacity: 0.3, cursor: 'not-allowed' }}
                  />
                </HStack>
                <Text color="gray.500" fontSize="xs" textAlign="center" mt={3}>
                  Each account will include Legacy, SegWit, and Native SegWit XPUBs
                </Text>
              </Box>
            )}
            
            <Box 
              p={4} 
              bg={theme.bg} 
              borderRadius="lg" 
              borderWidth="1px" 
              borderColor={theme.border}
            >
              <Text color="gray.400" fontSize="sm" mb={2} fontWeight="medium">
                Filename
              </Text>
              <Input
                value={reportOptions.filename}
                onChange={(e) => setReportOptions({
                  ...reportOptions,
                  filename: e.target.value
                })}
                placeholder="Enter filename"
                bg={theme.cardBg}
                borderColor={theme.border}
                color="white"
                size="sm"
                _hover={{ borderColor: theme.gold }}
                _focus={{ borderColor: theme.gold, boxShadow: `0 0 0 1px ${theme.gold}` }}
              />
            </Box>
          </VStack>
        </DialogBody>
        
        <DialogFooter pt={0}>
          <HStack gap={2} width="100%">
            <Button
              flex="1"
              size="md"
              variant="outline"
              onClick={onClose}
              isDisabled={loading}
              borderColor={theme.border}
              color="gray.400"
              _hover={{ 
                borderColor: theme.gold,
                color: theme.gold,
                bg: 'rgba(255, 215, 0, 0.05)'
              }}
            >
              Cancel
            </Button>
            <Button
              flex="2"
              size="md"
              bg={theme.gold}
              color="black"
              leftIcon={loading ? <Spinner size="sm" /> : <FaDownload />}
              onClick={generateAndDownloadPDF}
              isDisabled={loading}
              _hover={{ 
                bg: theme.goldHover,
                transform: 'scale(1.02)',
              }}
              _active={{
                transform: 'scale(0.98)',
              }}
              fontWeight="bold"
            >
              {loading ? 'Generating...' : 'Export PDF'}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};