import { BaseReportGenerator } from './BaseReportGenerator';
import { ReportData, ReportOptions, EVMAccountData } from './types';

export class EVMReportGenerator extends BaseReportGenerator {
  
  isSupported(assetContext: any): boolean {
    const networkId = assetContext?.networkId || '';
    const symbol = assetContext?.symbol || '';
    
    // Support EVM chains (Ethereum and compatible)
    return networkId.startsWith('eip155:') || 
           ['ETH', 'MATIC', 'BNB', 'AVAX', 'FTM', 'OP', 'ARB'].includes(symbol.toUpperCase());
  }

  getDefaultOptions(): ReportOptions {
    return {
      accountCount: 5, // EVM typically uses multiple addresses
      includeTransactions: true,
      includeAddresses: true
    };
  }

  async generateReport(assetContext: any, app: any, options: ReportOptions): Promise<ReportData> {
    const accountCount = options.accountCount || 5;
    const accounts: EVMAccountData[] = [];
    
    // Get account data for each address
    for (let i = 0; i < Math.min(accountCount, assetContext.pubkeys?.length || 0); i++) {
      const pubkey = assetContext.pubkeys[i];
      if (pubkey?.address) {
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
          headers: ['Address', 'Balance', 'Nonce', 'TX Count', 'Token Holdings'],
          widths: ['30%', '15%', '10%', '10%', '35%'],
          rows: accounts.map(acc => [
            { text: this.truncateAddress(acc.address), fontSize: 9 },
            `${acc.balance} ${assetContext.symbol}`,
            acc.nonce.toString(),
            acc.transactionCount.toString(),
            this.formatTokenHoldings(acc.tokenBalances)
          ])
        }
      },
      {
        title: 'Portfolio Statistics',
        type: 'summary' as const,
        data: [
          `Total Addresses: ${accounts.length}`,
          `Active Addresses: ${accounts.filter(a => parseFloat(a.balance) > 0).length}`,
          `Total Balance: ${this.calculateTotalBalance(accounts, assetContext.symbol)}`,
          `Total Transactions: ${this.calculateTotalTransactions(accounts)}`,
          `Unique Tokens Held: ${this.countUniqueTokens(accounts)}`
        ]
      }
    ];

    // Add token details if any tokens are held
    const tokenDetails = this.getTokenDetails(accounts);
    if (tokenDetails.length > 0) {
      sections.push({
        title: 'Token Holdings Detail',
        type: 'table' as const,
        data: {
          headers: ['Token', 'Total Balance', 'Addresses Holding', 'Contract'],
          widths: ['20%', '20%', '20%', '40%'],
          rows: tokenDetails
        }
      });
    }

    sections.push({
      title: 'Network Information',
      type: 'list' as const,
      data: [
        `Network: ${assetContext.name || 'Ethereum'}`,
        `Chain ID: ${this.extractChainId(assetContext.networkId)}`,
        `Native Token: ${assetContext.symbol}`,
        `Report Generated: ${this.getCurrentDate()}`
      ]
    });

    return {
      title: `${assetContext.name} Account Report`,
      subtitle: `${assetContext.symbol} Wallet Analysis`,
      generatedDate: this.getCurrentDate(),
      sections
    };
  }

  private async getAccountData(assetContext: any, app: any, pubkey: any): Promise<EVMAccountData> {
    const address = pubkey.address;
    let balance = '0';
    let nonce = 0;
    let transactionCount = 0;
    let tokenBalances: any[] = [];

    // Get balance from pubkey data
    if (pubkey.balances && pubkey.balances.length > 0) {
      const nativeBalance = pubkey.balances.find((b: any) => 
        b.asset === assetContext.symbol || b.ticker === assetContext.symbol
      );
      if (nativeBalance) {
        balance = this.formatBalance(nativeBalance.balance || '0', this.getDecimals(assetContext.symbol));
      }
    }

    // Get token balances
    if (pubkey.balances) {
      tokenBalances = pubkey.balances
        .filter((b: any) => b.asset !== assetContext.symbol && b.ticker !== assetContext.symbol)
        .map((b: any) => ({
          symbol: b.ticker || b.asset,
          balance: this.formatBalance(b.balance || '0', b.decimals || 18),
          contractAddress: b.contract || 'Unknown'
        }));
    }

    // Try to get additional data from app context
    if (app?.pioneer && address) {
      try {
        // Get transaction count if available
        // This would depend on Pioneer API capabilities
        transactionCount = pubkey.txCount || 0;
        nonce = pubkey.nonce || 0;
      } catch (e) {
        console.error('Error getting account data:', e);
      }
    }

    return {
      address,
      balance,
      nonce,
      tokenBalances,
      transactionCount
    };
  }

  private truncateAddress(address: string): string {
    if (address.length <= 20) return address;
    return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
  }

  private formatTokenHoldings(tokens?: any[]): string {
    if (!tokens || tokens.length === 0) return 'No tokens';
    if (tokens.length <= 2) {
      return tokens.map(t => `${t.balance} ${t.symbol}`).join(', ');
    }
    return `${tokens.length} tokens`;
  }

  private calculateTotalBalance(accounts: EVMAccountData[], symbol: string): string {
    const total = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || '0'), 0);
    return `${total.toFixed(6)} ${symbol}`;
  }

  private calculateTotalTransactions(accounts: EVMAccountData[]): number {
    return accounts.reduce((sum, acc) => sum + acc.transactionCount, 0);
  }

  private countUniqueTokens(accounts: EVMAccountData[]): number {
    const tokens = new Set<string>();
    accounts.forEach(acc => {
      acc.tokenBalances?.forEach(token => {
        tokens.add(token.symbol);
      });
    });
    return tokens.size;
  }

  private getTokenDetails(accounts: EVMAccountData[]): any[] {
    const tokenMap = new Map<string, {
      totalBalance: number;
      addresses: Set<string>;
      contract: string;
    }>();

    accounts.forEach(acc => {
      acc.tokenBalances?.forEach(token => {
        if (!tokenMap.has(token.symbol)) {
          tokenMap.set(token.symbol, {
            totalBalance: 0,
            addresses: new Set(),
            contract: token.contractAddress
          });
        }
        const data = tokenMap.get(token.symbol)!;
        data.totalBalance += parseFloat(token.balance);
        data.addresses.add(acc.address);
      });
    });

    return Array.from(tokenMap.entries()).map(([symbol, data]) => [
      symbol,
      data.totalBalance.toFixed(6),
      data.addresses.size.toString(),
      { text: this.truncateAddress(data.contract), fontSize: 8 }
    ]);
  }

  private extractChainId(networkId: string): string {
    if (networkId.startsWith('eip155:')) {
      return networkId.replace('eip155:', '');
    }
    return 'Unknown';
  }

  private getDecimals(symbol: string): number {
    // Most EVM chains use 18 decimals
    const decimalsMap: Record<string, number> = {
      'ETH': 18,
      'MATIC': 18,
      'BNB': 18,
      'AVAX': 18,
      'FTM': 18,
      'OP': 18,
      'ARB': 18
    };
    return decimalsMap[symbol.toUpperCase()] || 18;
  }
}