import { BaseReportGenerator } from './BaseReportGenerator';
import { ReportData, ReportOptions, XPUBData, AddressData, TransactionData } from './types';
import { analyzeAddressFlow, generateAddressFlowSummary } from '@/utils/addressFlowAnalyzer';

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
      includeAddresses: false,
      lodLevel: 1, // Default to basic XPUB report
      gapLimit: 20 // Default gap limit for address discovery
    };
  }

  async generateReport(assetContext: any, app: any, options: ReportOptions): Promise<ReportData> {
    const accountCount = options.accountCount || 3;
    const lodLevel = options.lodLevel || 1;

    console.log('📊 [REPORT] Starting report generation:', {
      symbol: assetContext.symbol,
      accountCount,
      lodLevel,
      gapLimit: options.gapLimit
    });

    // FAIL FAST: Get device features before generating report
    console.log('🔍 [DEVICE] Fetching device features...');
    if (!app?.keepKeySdk?.system?.info?.getFeatures) {
      throw new Error('❌ FATAL: KeepKey SDK not available or missing getFeatures method. Cannot generate report without device information.');
    }

    let deviceFeatures;
    try {
      deviceFeatures = await app.keepKeySdk.system.info.getFeatures();
      console.log('✅ [DEVICE] Features retrieved');
    } catch (error) {
      console.error('❌ [DEVICE] Failed to get features:', error);
      throw new Error(`❌ FATAL: Cannot get device features. Error: ${error}. Report generation aborted.`);
    }

    if (!deviceFeatures) {
      throw new Error('❌ FATAL: Device features returned null/undefined. Ensure KeepKey is connected and unlocked.');
    }

    // Extract device ID/label from features
    const deviceLabel = deviceFeatures.label || deviceFeatures.device_label || deviceFeatures.deviceLabel;
    const deviceId = deviceFeatures.device_id || deviceFeatures.deviceId;
    const deviceName = deviceLabel || deviceId || 'KeepKey';

    console.log('✅ [DEVICE] Using device name:', deviceName);

    // Get XPUBs from balances (already loaded by Pioneer SDK)
    const allBalances = app.balances || [];
    if (allBalances.length === 0) {
      throw new Error('❌ FATAL: No balances available from Pioneer SDK. Ensure wallet is initialized.');
    }

    console.log(`📊 [BALANCES] Found ${allBalances.length} balances from SDK`);

    // Build pubkeys array for server API call (matching e2e test approach)
    const pubkeys = allBalances
      .filter((b: any) => b.symbol === assetContext.symbol)
      .slice(0, accountCount * 3) // 3 address types per account
      .map((balance: any, index: number) => {
        const xpub = balance.pubkey || balance.master || balance.address;

        // Determine script type from xpub prefix
        let type: 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' = 'p2pkh';
        if (xpub.startsWith('xpub')) type = 'p2pkh';
        else if (xpub.startsWith('ypub')) type = 'p2sh-p2wpkh';
        else if (xpub.startsWith('zpub')) type = 'p2wpkh';

        return {
          xpub,
          type,
          path: balance.path || balance.pathMaster || 'Unknown',
          label: `Account ${index}`
        };
      });

    if (pubkeys.length === 0) {
      throw new Error(`❌ FATAL: No ${assetContext.symbol} balances found in loaded wallet data.`);
    }

    console.log(`📡 [API] Calling Pioneer Server API with ${pubkeys.length} pubkeys at LOD ${lodLevel}...`);

    // Call Pioneer Server REST API (matching e2e test exactly)
    const serverUrl = process.env.NEXT_PUBLIC_PIONEER_URL_SPEC?.replace('/spec/swagger.json', '') || 'http://localhost:9001';
    const serverReport = await this.fetchServerReport(serverUrl, pubkeys, lodLevel, options.gapLimit || 20);

    console.log('✅ [API] Server report received');

    // Transform server response using E2E test logic
    console.log('🔄 [TRANSFORM] Transforming server data (using E2E test logic)...');
    const reportSections = this.transformServerData(serverReport, lodLevel);

    // Add device information section at the beginning
    const sections: any[] = [
      {
        title: 'Device Features',
        type: 'summary',
        data: [
          `Vendor: ${deviceFeatures.vendor || 'Unknown'}`,
          `Model: ${deviceFeatures.model || 'KeepKey'}`,
          `Device ID: ${deviceId || 'Unknown'}`,
          `Label: ${deviceLabel || 'Not set'}`,
          `Firmware: ${deviceFeatures.firmwareVersion || deviceFeatures.firmware_version || 'Unknown'}`,
          `Bootloader: ${deviceFeatures.bootloaderVersion || deviceFeatures.bootloader_version || 'Unknown'}`,
          `Initialized: ${deviceFeatures.initialized ? 'Yes' : 'No'}`,
          `PIN Protection: ${deviceFeatures.pin_protection || deviceFeatures.pinProtection ? 'Enabled' : 'Disabled'}`,
          `Passphrase Protection: ${deviceFeatures.passphrase_protection || deviceFeatures.passphraseProtection ? 'Enabled' : 'Disabled'}`,
          `Supported Coins: ${deviceFeatures.coins?.length || 0}`
        ]
      },
      ...reportSections
    ];

    return {
      title: `${deviceName} Report LOD:${lodLevel}`,
      subtitle: `${assetContext.symbol} Wallet Analysis - ${accountCount} Accounts`,
      generatedDate: this.getCurrentDate(),
      sections
    };
  }

  /**
   * Fetch report from Pioneer Server REST API
   * Matches e2e test implementation exactly
   */
  private async fetchServerReport(
    serverUrl: string,
    pubkeys: Array<{ xpub: string; type: string; path: string; label: string }>,
    lod: number,
    gapLimit: number
  ): Promise<any> {
    const requestBody = {
      pubkeys,
      lod,
      options: {
        gapLimit,
        includeEmpty: true
      }
    };

    console.log(`🌐 POST ${serverUrl}/api/v1/reports/bitcoin`);
    console.log(`📦 Request: ${pubkeys.length} pubkeys, LOD ${lod}`);

    const response = await fetch(`${serverUrl}/api/v1/reports/bitcoin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    let reportData: any = await response.json();

    // Handle async job response
    if (reportData.jobId) {
      console.log(`⏳ Report queued as async job: ${reportData.jobId}`);
      reportData = await this.pollForJobResult(serverUrl, reportData.jobId);
    }

    console.log(`✅ Received server report (LOD ${reportData.lod})`);
    return reportData;
  }

  /**
   * Poll for async job result
   * Matches e2e test implementation
   */
  private async pollForJobResult(serverUrl: string, jobId: string): Promise<any> {
    const maxAttempts = 60;
    const pollInterval = 1000;

    console.log(`🔄 Polling for job result (max ${maxAttempts} attempts)...`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const statusResponse = await fetch(`${serverUrl}/api/v1/reports/bitcoin/jobs/${jobId}`);

      if (!statusResponse.ok) {
        throw new Error(`Failed to check job status: ${statusResponse.status}`);
      }

      const job: any = await statusResponse.json();

      const percentage = job.progress ? Math.round((job.progress.current / job.progress.total) * 100) : 0;
      console.log(`  Progress: ${percentage}% - ${job.status} - ${job.progress?.message || 'Processing...'}`);

      if (job.status === 'completed') {
        console.log('✅ Job completed!');

        const resultResponse = await fetch(`${serverUrl}/api/v1/reports/bitcoin/jobs/${jobId}/result`);

        if (!resultResponse.ok) {
          throw new Error(`Failed to get job result: ${resultResponse.status}`);
        }

        return await resultResponse.json();
      }

      if (job.status === 'failed') {
        console.log('❌ Job failed!');
        throw new Error(`Job failed: ${job.error || 'Unknown error'}`);
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error('Job polling timed out after 60 seconds');
  }

  /**
   * Transform server API response into report sections
   * COPIED FROM E2E TEST - EXACT SAME LOGIC
   */
  private transformServerData(serverData: any, lod: number): any[] {
    const sections: any[] = [];

    // LOD 0: Overview
    if (lod >= 0) {
      sections.push(this.createOverviewSection(serverData));
    }

    // LOD 1: XPUB summaries
    if (lod >= 1) {
      sections.push(this.createXpubSummariesSection(serverData));
    }

    // LOD 2: XPUB details with used addresses
    if (lod >= 2) {
      sections.push(this.createXpubDetailsSection(serverData));
    }

    // LOD 3: All addresses (used and unused)
    if (lod >= 3) {
      sections.push(this.createAllAddressesSection(serverData));
    }

    // LOD 4: Transaction summary
    if (lod >= 4) {
      sections.push(this.createTransactionSummarySection(serverData));
    }

    // LOD 5: Full transaction details with paths
    if (lod >= 5) {
      sections.push(this.createFullTransactionDetailsSection(serverData));
    }

    return sections;
  }

  /**
   * Create overview section (LOD 0)
   * COPIED FROM E2E TEST
   */
  private createOverviewSection(serverData: any): any {
    return {
      title: 'Portfolio Overview (LOD 0)',
      type: 'summary',
      data: [
        `Total Balance: ${serverData.totalBalanceBTC?.toFixed(8) || '0.00000000'} BTC`,
        `USD Value: $${serverData.totalBalanceUSD?.toFixed(2) || '0.00'}`,
        `Total XPUBs: ${serverData.totalXpubs || 0}`,
        `Last Updated: ${serverData.lastUpdated || new Date().toISOString()}`
      ]
    };
  }

  /**
   * Create XPUB summaries section (LOD 1)
   * COPIED FROM E2E TEST
   */
  private createXpubSummariesSection(serverData: any): any {
    const xpubs = serverData.xpubs || [];

    if (xpubs.length === 0) {
      return {
        title: 'XPUB Summaries (LOD 1)',
        type: 'text',
        data: 'No XPUBs found'
      };
    }

    const rows = xpubs.map((xpub: any) => [
      xpub.label || 'Unknown',
      xpub.type,
      xpub.path,
      xpub.xpub,  // Full XPUB, no truncation
      xpub.balance?.toFixed(8) || '0.00000000',
      (xpub.addressCount || 0).toString(),
      (xpub.txCount || 0).toString()
    ]);

    return {
      title: 'XPUB Summaries (LOD 1)',
      type: 'table',
      data: {
        headers: ['Label', 'Type', 'Path', 'XPUB', 'Balance (BTC)', 'Addresses', 'TXs'],
        rows
      }
    };
  }

  /**
   * Create XPUB details section (LOD 2)
   * COPIED FROM E2E TEST - Returns structured XPUB data
   */
  private createXpubDetailsSection(serverData: any): any {
    const xpubs = serverData.xpubs || [];

    if (xpubs.length === 0) {
      return {
        title: 'XPUB Details with Used Addresses (LOD 2)',
        type: 'xpub_details',
        data: []
      };
    }

    const xpubDetails = xpubs.map((xpub: any) => {
      // Map addresses
      const addresses = (xpub.addresses || []).map((addr: any) => ({
        address: addr.address,
        path: addr.path,
        type: addr.type,
        balance: addr.balance || 0,
        txCount: addr.txCount || 0,
        isChange: addr.type === 'change',
        isUsed: (addr.txCount || 0) > 0 || (addr.balance || 0) > 0,
        txids: addr.txids || []
      }));

      return {
        label: xpub.label || 'Unknown',
        type: xpub.type,
        xpub: xpub.xpub,
        path: xpub.path,
        balance: xpub.balance || 0,
        totalReceived: xpub.totalReceived || 0,
        totalSent: xpub.totalSent || 0,
        txCount: xpub.txCount || 0,
        receiveIndex: xpub.receiveIndex || 0,
        changeIndex: xpub.changeIndex || 0,
        addresses
      };
    });

    return {
      title: 'XPUB Details with Used Addresses (LOD 2)',
      type: 'xpub_details',
      data: xpubDetails
    };
  }

  /**
   * Create all addresses section (LOD 3)
   * COPIED FROM E2E TEST - Returns structured address data
   */
  private createAllAddressesSection(serverData: any): any {
    const xpubs = serverData.xpubs || [];
    const allAddresses: any[] = [];

    // Collect all addresses from all xpubs
    for (const xpub of xpubs) {
      const addresses = xpub.addresses || [];
      for (const addr of addresses) {
        allAddresses.push({
          address: addr.address,
          path: addr.path,
          type: addr.type,
          balance: addr.balance || 0,
          txCount: addr.txCount || 0,
          isChange: addr.type === 'change',
          isUsed: (addr.txCount || 0) > 0 || (addr.balance || 0) > 0,
          txids: addr.txids || []
        });
      }
    }

    if (allAddresses.length === 0) {
      return {
        title: 'All Addresses - Used and Unused (LOD 3)',
        type: 'address_details',
        data: {
          total: 0,
          receiveAddresses: [],
          changeAddresses: []
        }
      };
    }

    // Group by type
    const receiveAddrs = allAddresses.filter(a => a.type === 'receive');
    const changeAddrs = allAddresses.filter(a => a.type === 'change');

    return {
      title: 'All Addresses - Used and Unused (LOD 3)',
      type: 'address_details',
      data: {
        total: allAddresses.length,
        receiveAddresses: receiveAddrs,
        changeAddresses: changeAddrs
      }
    };
  }

  /**
   * Create transaction summary section (LOD 4)
   * COPIED FROM E2E TEST
   */
  private createTransactionSummarySection(serverData: any): any {
    const xpubs = serverData.xpubs || [];
    const allTransactions: any[] = [];

    // Collect all unique transactions
    const txMap = new Map<string, any>();

    for (const xpub of xpubs) {
      const addresses = xpub.addresses || [];
      for (const addr of addresses) {
        const transactions = addr.transactions || [];
        for (const tx of transactions) {
          if (!txMap.has(tx.txid)) {
            txMap.set(tx.txid, tx);
          }
        }
      }
    }

    const transactions = Array.from(txMap.values()).sort((a, b) => b.blockHeight - a.blockHeight);

    if (transactions.length === 0) {
      return {
        title: 'Transaction Summary (LOD 4)',
        type: 'text',
        data: 'No transactions found'
      };
    }

    const rows = transactions.map((tx, idx) => [
      (idx + 1).toString(),
      `${tx.txid.substring(0, 16)}...`,
      tx.blockHeight.toString(),
      tx.timestamp || 'Pending',
      tx.value?.toFixed(8) || '0.00000000',
      tx.confirmations?.toString() || '0'
    ]);

    let summary = `\nTotal Transactions: ${transactions.length}\n`;
    summary += `Block Range: ${Math.min(...transactions.map((t: any) => t.blockHeight))} - ${Math.max(...transactions.map((t: any) => t.blockHeight))}\n`;

    return {
      title: 'Transaction Summary (LOD 4)',
      type: 'table',
      data: {
        headers: ['#', 'TXID', 'Block', 'Timestamp', 'Value (BTC)', 'Confirmations'],
        rows,
        footer: summary
      }
    };
  }

  /**
   * Create full transaction details section (LOD 5)
   * COPIED FROM E2E TEST - Returns structured transaction data
   */
  private createFullTransactionDetailsSection(serverData: any): any {
    const xpubs = serverData.xpubs || [];

    // Collect all detailed transactions
    const allDetailedTxs: any[] = [];

    for (const xpub of xpubs) {
      if (xpub.transactions) {
        allDetailedTxs.push(...xpub.transactions);
      }
    }

    // Remove duplicates by txid
    const txMap = new Map<string, any>();
    for (const tx of allDetailedTxs) {
      if (!txMap.has(tx.txid)) {
        txMap.set(tx.txid, tx);
      }
    }

    const rawTransactions = Array.from(txMap.values()).sort((a, b) => b.blockHeight - a.blockHeight);

    if (rawTransactions.length === 0) {
      return {
        title: 'Full Transaction Details with Paths (LOD 5)',
        type: 'transactions',
        data: []
      };
    }

    // Transform into structured transaction data
    const transactions = rawTransactions.map((tx: any) => {
      const inputs = tx.inputs || [];
      const outputs = tx.outputs || [];

      // Categorize transaction (SEND/RECEIVE/SELF)
      const hasOwnInputs = inputs.some((inp: any) => inp.isOwn);
      const hasOwnOutputs = outputs.some((out: any) => out.isOwn);

      let category: 'SEND' | 'RECEIVE' | 'SELF' = 'RECEIVE';
      if (hasOwnInputs && hasOwnOutputs) {
        category = 'SELF';
      } else if (hasOwnInputs) {
        category = 'SEND';
      }

      // Map inputs
      const mappedInputs = inputs.map((inp: any) => ({
        address: inp.address,
        value: inp.value || 0,
        isOwn: inp.isOwn || false,
        path: inp.path || null,
        isChange: inp.isChange || false
      }));

      // Map outputs
      const mappedOutputs = outputs.map((out: any) => ({
        address: out.address,
        value: out.value || 0,
        isOwn: out.isOwn || false,
        path: out.path || null,
        isChange: out.isChange || false
      }));

      return {
        txid: tx.txid,
        blockHeight: tx.blockHeight,
        timestamp: tx.timestamp || 'Pending',
        confirmations: tx.confirmations || 0,
        value: tx.value || 0,
        fee: tx.fee || 0,
        category,
        inputs: mappedInputs,
        outputs: mappedOutputs
      };
    });

    return {
      title: 'Full Transaction Details with Paths (LOD 5)',
      type: 'transactions',
      data: transactions
    };
  }

  /**
   * Convert script type to display name
   */
  private getTypeFromScriptType(scriptType: string): string {
    const typeMap: Record<string, string> = {
      'p2pkh': 'Legacy',
      'p2sh-p2wpkh': 'SegWit',
      'p2wpkh': 'Native SegWit'
    };
    return typeMap[scriptType] || scriptType;
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

  private getDecimals(): number {
    // Most UTXO coins use 8 decimals
    return 8;
  }

  // NEVER truncate XPUBs in reports - show full data always

  private calculateTotalBalance(xpubData: XPUBData[]): string {
    const total = xpubData.reduce((sum, row) => sum + parseFloat(row.balance || '0'), 0);
    return total.toFixed(8);
  }

  private calculateTotalTransactions(xpubData: XPUBData[]): number {
    return xpubData.reduce((sum, row) => sum + row.txCount, 0);
  }
}