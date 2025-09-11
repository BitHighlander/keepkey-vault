import { BaseReportGenerator } from './BaseReportGenerator';
import { ReportData, ReportOptions } from './types';

export class GenericReportGenerator extends BaseReportGenerator {
  
  isSupported(assetContext: any): boolean {
    // This is the fallback generator for any chain not explicitly supported
    return true;
  }

  getDefaultOptions(): ReportOptions {
    return {
      accountCount: 1,
      includeTransactions: false,
      includeAddresses: true
    };
  }

  async generateReport(assetContext: any, app: any, options: ReportOptions): Promise<ReportData> {
    const accounts: any[] = [];
    
    // Gather account data from pubkeys
    if (assetContext.pubkeys && assetContext.pubkeys.length > 0) {
      for (let i = 0; i < Math.min(options.accountCount || 1, assetContext.pubkeys.length); i++) {
        const pubkey = assetContext.pubkeys[i];
        const accountData = await this.getAccountData(assetContext, app, pubkey);
        accounts.push(accountData);
      }
    }

    // Create report sections
    const sections = [
      {
        title: 'Account Summary',
        type: 'table' as const,
        data: {
          headers: ['Address', 'Balance', 'Network', 'Path'],
          widths: ['35%', '20%', '20%', '25%'],
          rows: accounts.map(acc => [
            { text: this.truncateAddress(acc.address), fontSize: 9 },
            `${acc.balance} ${assetContext.symbol}`,
            assetContext.networkId || 'Unknown',
            acc.path || 'N/A'
          ])
        }
      },
      {
        title: 'Asset Information',
        type: 'summary' as const,
        data: [
          `Asset Name: ${assetContext.name || 'Unknown'}`,
          `Symbol: ${assetContext.symbol || 'Unknown'}`,
          `Network: ${assetContext.networkId || 'Unknown'}`,
          `Chain: ${assetContext.chain || 'Unknown'}`,
          `Total Accounts: ${accounts.length}`,
          `Total Balance: ${this.calculateTotalBalance(accounts, assetContext.symbol)}`
        ]
      }
    ];

    // Add balance details if multiple balances exist
    const hasMultipleBalances = accounts.some(acc => acc.balances && acc.balances.length > 1);
    if (hasMultipleBalances) {
      sections.push({
        title: 'Token Balances',
        type: 'table' as const,
        data: {
          headers: ['Address', 'Token', 'Balance'],
          widths: ['40%', '30%', '30%'],
          rows: this.getTokenBalanceRows(accounts)
        }
      });
    }

    sections.push({
      title: 'Additional Information',
      type: 'list' as const,
      data: [
        `Report Generated: ${this.getCurrentDate()}`,
        'This is a generic report format',
        'Some features may not be available for this network',
        'For detailed information, check your wallet interface'
      ]
    });

    return {
      title: `${assetContext.name || 'Asset'} Report`,
      subtitle: `${assetContext.symbol || 'Token'} Account Analysis`,
      generatedDate: this.getCurrentDate(),
      sections
    };
  }

  private async getAccountData(assetContext: any, app: any, pubkey: any): Promise<any> {
    const address = pubkey.address || pubkey.master || 'Unknown';
    let balance = '0';
    let balances: any[] = [];
    
    // Get balance from pubkey data
    if (pubkey.balances && pubkey.balances.length > 0) {
      // Find native balance
      const nativeBalance = pubkey.balances.find((b: any) => 
        b.asset === assetContext.symbol || 
        b.ticker === assetContext.symbol ||
        b.isNative
      );
      
      if (nativeBalance) {
        const decimals = nativeBalance.decimals || this.guessDecimals(assetContext.symbol);
        balance = this.formatBalance(nativeBalance.balance || '0', decimals);
      }
      
      // Collect all balances
      balances = pubkey.balances.map((b: any) => ({
        asset: b.asset || b.ticker || 'Unknown',
        balance: b.balance || '0',
        decimals: b.decimals || 18
      }));
    }

    return {
      address,
      balance,
      balances,
      path: pubkey.path || pubkey.pathMaster || 'N/A',
      type: pubkey.type || 'Unknown'
    };
  }

  private truncateAddress(address: string): string {
    if (!address || address === 'Unknown') return address;
    if (address.length <= 20) return address;
    
    // Handle different address formats
    if (address.startsWith('0x')) {
      // EVM-style address
      return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
    } else if (address.length > 50) {
      // Long addresses (Cosmos, etc.)
      return `${address.substring(0, 12)}...${address.substring(address.length - 8)}`;
    } else {
      // Short addresses
      return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
    }
  }

  private calculateTotalBalance(accounts: any[], symbol: string): string {
    const total = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || '0'), 0);
    return `${total.toFixed(6)} ${symbol}`;
  }

  private getTokenBalanceRows(accounts: any[]): any[] {
    const rows: any[] = [];
    
    accounts.forEach(acc => {
      if (acc.balances && acc.balances.length > 0) {
        acc.balances.forEach((bal: any) => {
          rows.push([
            { text: this.truncateAddress(acc.address), fontSize: 8 },
            bal.asset,
            this.formatBalance(bal.balance, bal.decimals)
          ]);
        });
      }
    });
    
    return rows;
  }

  private guessDecimals(symbol: string): number {
    // Common decimal configurations
    const decimalMap: Record<string, number> = {
      'BTC': 8,
      'ETH': 18,
      'BNB': 18,
      'ATOM': 6,
      'XRP': 6,
      'ADA': 6,
      'DOT': 10,
      'SOL': 9,
      'AVAX': 18,
      'MATIC': 18
    };
    
    return decimalMap[symbol?.toUpperCase()] || 18;
  }
}