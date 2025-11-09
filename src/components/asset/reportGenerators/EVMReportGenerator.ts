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
      lod: 1 // Default level of detail (synced with e2e)
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

    // Get addresses from assetContext.pubkeys
    if (!assetContext.pubkeys || assetContext.pubkeys.length === 0) {
      throw new Error('❌ FATAL: No pubkeys available in asset context. Ensure wallet is initialized.');
    }

    // Build addresses array for server API call
    const addresses = assetContext.pubkeys
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
      sections.push({
        title: 'Account Summary',
        type: 'table' as const,
        data: {
          headers: ['Address', 'Balance', 'USD Value', 'Nonce', 'Tokens'],
          widths: ['35%', '15%', '15%', '10%', '25%'],
          rows: serverData.addresses.map((addr: any) => [
            { text: this.truncateAddress(addr.address), fontSize: 9 },
            `${addr.balanceETH || 0} ${assetContext.symbol}`,
            `$${addr.balanceUSD || 0}`,
            addr.nonce?.toString() || '0',
            addr.tokenCount ? `${addr.tokenCount} tokens` : 'No tokens'
          ])
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
          title: 'Token Holdings Detail',
          type: 'table' as const,
          data: {
            headers: ['Token', 'Balance', 'USD Value', 'Contract'],
            widths: ['25%', '20%', '20%', '35%'],
            rows: allTokens.map(token => [
              token.symbol || 'Unknown',
              token.balance || '0',
              `$${token.valueUSD || 0}`,
              { text: this.truncateAddress(token.contractAddress || ''), fontSize: 8 }
            ])
          }
        });
      }
    }

    return sections;
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
