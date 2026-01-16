import { BaseReportGenerator } from './BaseReportGenerator';
import { ReportData, ReportOptions } from './types';

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
      includeAddresses: true,
      lod: 4 // LOD 4 includes tokens + transaction history (from unchained)
    };
  }

  async generateReport(assetContext: any, app: any, options: ReportOptions): Promise<ReportData> {
    const lod = options.lod || options.lodLevel || 1;
    const accountCount = options.accountCount || 5;

    console.log('📊 [EVM-REPORT] Starting report generation:', {
      symbol: assetContext.symbol,
      networkId: assetContext.networkId,
      accountCount,
      lod
    });

    // Get pubkeys - try assetContext.pubkeys first, then fall back to app.balances
    let pubkeys = assetContext.pubkeys;

    if (!pubkeys || pubkeys.length === 0) {
      console.log('⚠️ No pubkeys in assetContext, falling back to app.balances');
      const allBalances = app.balances || [];

      // For EVM chains, all use the same Ethereum address
      // First, try to find addresses from the target chain
      pubkeys = allBalances.filter((b: any) => {
        const matchesSymbol = b.symbol === assetContext.symbol;

        // Match networkId - try multiple fields and formats
        const targetNetworkId = assetContext.networkId;
        const balanceNetworkId = b.networkId || b.caip || b.network;

        const matchesNetwork = balanceNetworkId === targetNetworkId ||
                              balanceNetworkId?.includes(targetNetworkId) ||
                              targetNetworkId?.includes(balanceNetworkId);

        return matchesSymbol && matchesNetwork && b.address;
      });

      console.log(`📊 Found ${pubkeys.length} addresses from target chain balances`);

      // If no addresses found on target chain, get Ethereum addresses (same for all EVM chains)
      if (pubkeys.length === 0) {
        console.log('⚠️ No addresses on target chain, falling back to ETH addresses (same for all EVM)');

        // Debug: Show what ETH balances exist
        const ethBalances = allBalances.filter((b: any) => b.symbol === 'ETH');
        console.log(`📊 Debug: Found ${ethBalances.length} total ETH balances`);
        if (ethBalances.length > 0) {
          console.log('📊 Debug: Sample ETH balance:', {
            symbol: ethBalances[0].symbol,
            networkId: ethBalances[0].networkId,
            caip: ethBalances[0].caip,
            address: ethBalances[0].address,
            pubkey: ethBalances[0].pubkey,
            master: ethBalances[0].master,
            path: ethBalances[0].path,
            pathMaster: ethBalances[0].pathMaster
          });
        }

        // Get ETH addresses - they work for all EVM chains
        // Use pubkey or address field (pubkey is the actual address for EVM chains)
        const ethAddresses = allBalances.filter((b: any) =>
          b.symbol === 'ETH' &&
          (b.networkId === 'eip155:1' || b.caip?.includes('eip155:1')) &&
          (b.pubkey || b.address)
        );

        console.log(`📊 Found ${ethAddresses.length} ETH addresses to use for ${assetContext.symbol}`);

        if (ethAddresses.length > 0) {
          // Create pubkey objects with ETH addresses but target chain's networkId
          // Use pubkey field as the address (it's the actual Ethereum address)
          pubkeys = ethAddresses.map((ethBalance: any) => ({
            address: ethBalance.pubkey || ethBalance.address,
            path: ethBalance.path || ethBalance.pathMaster || "m/44'/60'/0'/0/0",
            symbol: assetContext.symbol,
            networkId: assetContext.networkId,
            balance: '0', // Will be fetched from server
            balances: [] // Will be populated with tokens
          }));
        }
      }

      console.log(`📊 Final: ${pubkeys.length} addresses for ${assetContext.symbol} (${assetContext.networkId})`);
    }

    if (!pubkeys || pubkeys.length === 0) {
      throw new Error(`❌ FATAL: No addresses found for ${assetContext.symbol} (${assetContext.networkId}). Ensure wallet is loaded and this chain is supported.`);
    }

    // Build addresses array for server API call
    const addresses = pubkeys
      .filter((p: any) => p.address)
      .slice(0, accountCount)
      .map((pubkey: any) => ({
        address: pubkey.address,
        path: pubkey.path || pubkey.pathMaster || 'Unknown'
      }));

    if (addresses.length === 0) {
      throw new Error(`❌ FATAL: No ${assetContext.symbol} addresses found in loaded wallet data.`);
    }

    console.log(`📡 [API] Calling Pioneer Server API with ${addresses.length} addresses at LOD ${lod}...`);

    // Call Pioneer Server REST API
    const serverUrl = process.env.NEXT_PUBLIC_PIONEER_URL_SPEC?.replace('/spec/swagger.json', '') || 'http://localhost:9001';
    const serverReport = await this.fetchServerReport(serverUrl, assetContext.networkId, addresses, lod, options);

    console.log('✅ [API] Server report received');

    // Get token data from charts/portfolio endpoint
    console.log('📊 [API] Fetching token data from charts endpoint...');
    const portfolioData = await this.fetchPortfolioData(serverUrl, pubkeys);
    console.log('✅ [API] Portfolio data received');

    // Merge token data with report data
    this.mergeTokenData(serverReport, portfolioData, assetContext, pubkeys);

    // Transform server response into report sections
    const sections = this.transformServerData(serverReport, assetContext);

    return {
      title: `${assetContext.name} Account Report`,
      subtitle: `${assetContext.symbol} Wallet Analysis`,
      generatedDate: this.getCurrentDate(),
      chain: assetContext.symbol,
      lod: lod,
      sections
    };
  }

  /**
   * Fetch report from Pioneer Server REST API
   */
  private async fetchServerReport(
    serverUrl: string,
    networkId: string,
    addresses: Array<{ address: string; path: string }>,
    lod: number,
    options: ReportOptions
  ): Promise<any> {
    const requestBody = {
      networkId,
      addresses,
      lod,
      options: {
        includeTokens: options.includeAddresses !== false,
        includeNFTs: false
      }
    };

    console.log(`🌐 POST ${serverUrl}/api/v1/reports/ethereum`);

    const response = await fetch(`${serverUrl}/api/v1/reports/ethereum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const reportData = await response.json();
    console.log(`✅ Received server report (LOD ${reportData.lod})`);
    return reportData;
  }

  /**
   * Fetch portfolio data including tokens from charts endpoint
   */
  private async fetchPortfolioData(serverUrl: string, pubkeys: any[]): Promise<any> {
    try {
      const response = await fetch(`${serverUrl}/charts/portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkeys })
      });

      if (!response.ok) {
        console.warn('Portfolio endpoint failed, continuing without token data');
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn('Error fetching portfolio data:', error);
      return null;
    }
  }

  /**
   * Merge token data from portfolio into report addresses
   */
  private mergeTokenData(reportData: any, portfolioData: any, assetContext: any, pubkeys: any[]): void {
    if (!portfolioData || !reportData.addresses || !pubkeys) return;

    // Find tokens for this asset's addresses
    reportData.addresses.forEach((addr: any) => {
      const pubkey = pubkeys.find((p: any) => p.address === addr.address);
      if (!pubkey || !pubkey.balances) return;

      // Extract tokens from balances (exclude native token)
      const tokens = pubkey.balances
        .filter((b: any) => b.symbol !== assetContext.symbol && b.balance && parseFloat(b.balance) > 0)
        .map((b: any) => ({
          symbol: b.symbol || b.ticker,
          name: b.name || b.symbol,
          address: b.contract || b.contractAddress || 'Unknown',
          balance: b.balance,
          decimals: b.decimals || 18,
          balanceUSD: b.valueUsd || 0
        }));

      addr.tokens = tokens;
    });
  }

  /**
   * Transform server API response into report sections
   */
  private transformServerData(serverData: any, assetContext: any): any[] {
    const sections: any[] = [];

    // Add overview section
    sections.push({
      title: 'Portfolio Statistics',
      type: 'summary' as const,
      data: [
        `Total Addresses: ${serverData.totalAddresses || 0}`,
        `Total Balance: ${serverData.totalBalanceETH || 0} ${assetContext.symbol}`,
        `Total USD Value: $${serverData.totalBalanceUSD || 0}`,
        `Network: ${assetContext.name}`,
        `Chain ID: ${this.extractChainId(assetContext.networkId)}`,
        `Last Updated: ${serverData.lastUpdated || this.getCurrentDate()}`
      ]
    });

    // Add address details
    if (serverData.addresses && serverData.addresses.length > 0) {
      const hasTokens = serverData.lod >= 2;
      sections.push({
        title: 'Account Summary',
        type: 'table' as const,
        data: {
          headers: hasTokens
            ? ['Address', 'Balance', 'USD Value', 'TX Count', 'Token Count']
            : ['Address', 'Balance', 'USD Value', 'TX Count'],
          widths: hasTokens
            ? ['30%', '20%', '20%', '15%', '15%']
            : ['30%', '25%', '25%', '20%'],
          rows: serverData.addresses.map((addr: any) => {
            const baseRow = [
              { text: this.truncateAddress(addr.address), fontSize: 9 },
              `${addr.balance?.toFixed(6) || '0.000000'} ${assetContext.symbol}`,
              `$${addr.balanceUSD?.toFixed(2) || '0.00'}`,
              addr.txCount?.toString() || '0'
            ];
            if (hasTokens) {
              const tokenCount = addr.tokens?.length || 0;
              baseRow.push(tokenCount > 0 ? `${tokenCount} tokens` : 'No tokens');
            }
            return baseRow;
          })
        }
      });
    }

    // Add token details if LOD >= 2
    if (serverData.lod >= 2 && serverData.addresses) {
      const allTokens: any[] = [];
      serverData.addresses.forEach((addr: any) => {
        if (addr.tokens && addr.tokens.length > 0) {
          allTokens.push(...addr.tokens.map((t: any) => ({ ...t, ownerAddress: addr.address })));
        }
      });

      if (allTokens.length > 0) {
        sections.push({
          title: 'Token Holdings',
          type: 'table' as const,
          data: {
            headers: ['Token', 'Name', 'Balance', 'USD Value', 'Contract Address'],
            widths: ['15%', '25%', '15%', '15%', '30%'],
            rows: allTokens.map(token => [
              token.symbol || 'Unknown',
              token.name || 'Unknown',
              this.formatTokenBalance(token.balance, token.decimals),
              `$${token.balanceUSD?.toFixed(2) || '0.00'}`,
              { text: this.truncateAddress(token.address || ''), fontSize: 8 }
            ])
          }
        });
      }
    }

    // Add transaction history if LOD >= 3
    if (serverData.lod >= 3 && serverData.addresses) {
      const allTransactions: any[] = [];
      serverData.addresses.forEach((addr: any) => {
        if (addr.transactions && addr.transactions.length > 0) {
          allTransactions.push(...addr.transactions.map((tx: any) => ({ ...tx, ownerAddress: addr.address })));
        }
      });

      if (allTransactions.length > 0) {
        // Sort by block number descending (most recent first)
        allTransactions.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));

        sections.push({
          title: 'Transaction History',
          type: 'table' as const,
          data: {
            headers: ['Date', 'Type', 'From/To', 'Value', 'Status', 'TX Hash'],
            widths: ['15%', '10%', '25%', '15%', '10%', '25%'],
            rows: allTransactions.map(tx => {
              const isSent = tx.from.toLowerCase() === tx.ownerAddress.toLowerCase();
              const counterparty = isSent ? tx.to : tx.from;
              const valueETH = parseFloat(tx.value) / 1e18;

              return [
                this.formatDate(tx.timestamp),
                isSent ? 'SENT' : 'RECEIVED',
                { text: this.truncateAddress(counterparty), fontSize: 8 },
                `${valueETH.toFixed(6)} ${assetContext.symbol}`,
                tx.status === 'success' ? '✓' : '✗',
                { text: this.truncateAddress(tx.hash), fontSize: 7 }
              ];
            })
          }
        });

        // Add transaction summary
        const totalTxs = allTransactions.length;
        const successfulTxs = allTransactions.filter(tx => tx.status === 'success').length;
        const sentTxs = allTransactions.filter(tx => tx.from.toLowerCase() === tx.ownerAddress.toLowerCase()).length;
        const receivedTxs = totalTxs - sentTxs;

        sections.push({
          title: 'Transaction Summary',
          type: 'summary' as const,
          data: [
            `Total Transactions: ${totalTxs}`,
            `Successful: ${successfulTxs}`,
            `Failed: ${totalTxs - successfulTxs}`,
            `Sent: ${sentTxs}`,
            `Received: ${receivedTxs}`
          ]
        });
      }
    }

    return sections;
  }

  private formatTokenBalance(balance: string, decimals: number): string {
    try {
      const num = parseFloat(balance) / Math.pow(10, decimals);
      return num.toFixed(Math.min(decimals, 6));
    } catch (e) {
      return balance;
    }
  }

  private formatDate(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return timestamp;
    }
  }

  private truncateAddress(address: string): string {
    if (address.length <= 20) return address;
    return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
  }

  private extractChainId(networkId: string): string {
    if (networkId.startsWith('eip155:')) {
      return networkId.replace('eip155:', '');
    }
    return 'Unknown';
  }
}
