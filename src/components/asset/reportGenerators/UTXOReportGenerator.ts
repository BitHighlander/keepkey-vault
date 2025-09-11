import { BaseReportGenerator } from './BaseReportGenerator';
import { ReportData, ReportOptions, XPUBData } from './types';

const XPUB_TYPES = [
  { name: 'Legacy', bip: 44, prefix: 'xpub' },
  { name: 'SegWit', bip: 49, prefix: 'ypub' },
  { name: 'Native SegWit', bip: 84, prefix: 'zpub' },
] as const;

export class UTXOReportGenerator extends BaseReportGenerator {
  
  isSupported(assetContext: any): boolean {
    // Support Bitcoin and other UTXO chains
    const networkId = assetContext?.networkId || '';
    const symbol = assetContext?.symbol || '';
    
    // Check for UTXO-based chains
    return networkId.startsWith('bip122:') || 
           ['BTC', 'BCH', 'LTC', 'DOGE', 'DASH'].includes(symbol.toUpperCase());
  }

  getDefaultOptions(): ReportOptions {
    return {
      accountCount: 3,
      includeTransactions: false,
      includeAddresses: false
    };
  }

  async generateReport(assetContext: any, app: any, options: ReportOptions): Promise<ReportData> {
    const accountCount = options.accountCount || 3;
    const xpubData: XPUBData[] = [];
    
    // Generate XPUBs for each account
    for (let accountNum = 0; accountNum < accountCount; accountNum++) {
      for (const xpubType of XPUB_TYPES) {
        const data = await this.getXPUBData(assetContext, app, accountNum, xpubType);
        xpubData.push(data);
      }
    }

    // Create report sections
    const sections = [
      {
        title: 'XPUB Summary',
        type: 'table' as const,
        data: {
          headers: ['Account', 'Type', 'XPUB', 'Path', 'Receive Idx', 'Change Idx', 'Balance', 'TX Count'],
          widths: ['auto', 'auto', '35%', 'auto', 'auto', 'auto', 'auto', 'auto'],
          rows: xpubData.map(row => [
            row.account.toString(),
            row.type,
            { text: this.truncateXPUB(row.xpub), fontSize: 7 },
            { text: row.derivationPath, fontSize: 8 },
            row.receiveIndex.toString(),
            row.changeIndex.toString(),
            `${row.balance} ${assetContext.symbol}`,
            row.txCount.toString()
          ])
        }
      },
      {
        title: 'Account Statistics',
        type: 'summary' as const,
        data: [
          `Total Accounts Analyzed: ${accountCount}`,
          `XPUB Types per Account: 3 (Legacy, SegWit, Native SegWit)`,
          `Total XPUBs Generated: ${xpubData.length}`,
          `Total Balance: ${this.calculateTotalBalance(xpubData)} ${assetContext.symbol}`,
          `Total Transactions: ${this.calculateTotalTransactions(xpubData)}`
        ]
      },
      {
        title: 'Security Notice',
        type: 'list' as const,
        data: [
          'This report contains sensitive wallet information. Store securely.',
          'XPUBs can be used to view all addresses and balances for an account.',
          'Never share XPUBs with untrusted parties.',
          'Receive Index indicates the next unused receiving address.',
          'Change Index indicates the next unused change address.'
        ]
      }
    ];

    return {
      title: `${assetContext.name} XPUB Report`,
      subtitle: `${assetContext.symbol} Wallet Analysis`,
      generatedDate: this.getCurrentDate(),
      sections
    };
  }

  private async getXPUBData(
    assetContext: any, 
    app: any, 
    accountNum: number, 
    xpubType: typeof XPUB_TYPES[number]
  ): Promise<XPUBData> {
    const xpubPath = `m/${xpubType.bip}'/0'/${accountNum}'`;
    
    let xpub = '';
    let receiveIndex = 0;
    let changeIndex = 0;
    let totalReceived = '0';
    let totalSent = '0';
    let balance = '0';
    let txCount = 0;
    
    // Get the actual XPUB from the KeepKey device
    if (app?.keepKeySdk) {
      try {
        const addressNList = this.bip32ToAddressNList(xpubPath);
        const scriptType = this.getScriptType(xpubType.bip);
        
        const pathQuery = {
          addressNList,
          address_n: addressNList,
          coin: this.getCoinName(assetContext.symbol),
          script_type: scriptType,
          showDisplay: false,
          show_display: false
        };
        
        const responsePubkey = await app.keepKeySdk.system.info.getPublicKey(pathQuery);
        
        if (responsePubkey?.xpub) {
          xpub = responsePubkey.xpub;
        } else {
          xpub = 'NO_XPUB_RETURNED';
        }
      } catch (e) {
        console.error(`Error fetching XPUB for path ${xpubPath}:`, e);
        xpub = 'ERROR_FETCHING_XPUB';
      }
    } else {
      xpub = 'NO_DEVICE_CONNECTED';
    }
    
    // Get additional data from Pioneer API if available
    if (app?.pioneer?.GetChangeAddress && xpub && !xpub.includes('ERROR') && !xpub.includes('NO_')) {
      try {
        const addressInfo = await app.pioneer.GetChangeAddress({
          network: assetContext.symbol,
          xpub
        });
        
        if (addressInfo?.data?.data) {
          const actualData = addressInfo.data.data;
          
          changeIndex = actualData.changeIndex || 0;
          receiveIndex = actualData.receiveIndex || 0;
          
          // Convert satoshis to coin units (assuming 8 decimals for most UTXO coins)
          const decimals = this.getDecimals(assetContext.symbol);
          const divisor = Math.pow(10, decimals);
          
          if (actualData.totalReceived !== undefined) {
            totalReceived = (Number(actualData.totalReceived) / divisor).toFixed(decimals);
          }
          
          if (actualData.totalSent !== undefined) {
            totalSent = (Number(actualData.totalSent) / divisor).toFixed(decimals);
          }
          
          if (actualData.balance !== undefined) {
            balance = (Number(actualData.balance) / divisor).toFixed(decimals);
          }
          
          txCount = actualData.txs || actualData.addrTxCount || 0;
        }
      } catch (e) {
        console.error('Error getting address data from Pioneer:', e);
      }
    }
    
    return {
      account: accountNum,
      type: xpubType.name,
      xpub,
      derivationPath: xpubPath,
      receiveIndex,
      changeIndex,
      balance,
      totalReceived,
      totalSent,
      txCount
    };
  }

  private bip32ToAddressNList(path: string): number[] {
    if (!path) return [];
    
    const parts = path.split('/').filter(p => p !== 'm');
    return parts.map(part => {
      const isHardened = part.includes("'");
      const num = parseInt(part.replace("'", ""));
      return isHardened ? 0x80000000 + num : num;
    });
  }

  private getScriptType(bip: number): string {
    switch (bip) {
      case 44: return 'p2pkh';
      case 49: return 'p2sh-p2wpkh';
      case 84: return 'p2wpkh';
      default: return 'p2pkh';
    }
  }

  private getCoinName(symbol: string): string {
    const coinMap: Record<string, string> = {
      'BTC': 'Bitcoin',
      'BCH': 'Bitcoin Cash',
      'LTC': 'Litecoin',
      'DOGE': 'Dogecoin',
      'DASH': 'Dash'
    };
    return coinMap[symbol.toUpperCase()] || 'Bitcoin';
  }

  private getDecimals(symbol: string): number {
    // Most UTXO coins use 8 decimals
    return 8;
  }

  private truncateXPUB(xpub: string): string {
    if (xpub.length <= 40) return xpub;
    return `${xpub.substring(0, 20)}...${xpub.substring(xpub.length - 20)}`;
  }

  private calculateTotalBalance(xpubData: XPUBData[]): string {
    const total = xpubData.reduce((sum, row) => sum + parseFloat(row.balance || '0'), 0);
    return total.toFixed(8);
  }

  private calculateTotalTransactions(xpubData: XPUBData[]): number {
    return xpubData.reduce((sum, row) => sum + row.txCount, 0);
  }
}