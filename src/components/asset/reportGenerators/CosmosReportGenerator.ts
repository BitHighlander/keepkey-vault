import { BaseReportGenerator } from './BaseReportGenerator';
import { ReportData, ReportOptions, CosmosAccountData } from './types';

export class CosmosReportGenerator extends BaseReportGenerator {
  
  isSupported(assetContext: any): boolean {
    const networkId = assetContext?.networkId || '';
    const symbol = assetContext?.symbol || '';
    const chain = assetContext?.chain || '';
    
    // Support Cosmos ecosystem chains
    return networkId.startsWith('cosmos:') || 
           chain.toLowerCase().includes('cosmos') ||
           ['ATOM', 'OSMO', 'JUNO', 'STARS', 'SCRT', 'AKT', 'LUNA'].includes(symbol.toUpperCase());
  }

  getDefaultOptions(): ReportOptions {
    return {
      accountCount: 1, // Cosmos typically uses one main account
      includeTransactions: true,
      includeAddresses: true,
      lod: 1 // Default level of detail (synced with e2e)
    };
  }

  async generateReport(assetContext: any, app: any, options: ReportOptions): Promise<ReportData> {
    const accounts: CosmosAccountData[] = [];
    
    // Get account data from pubkeys
    if (assetContext.pubkeys && assetContext.pubkeys.length > 0) {
      for (const pubkey of assetContext.pubkeys) {
        if (pubkey.address) {
          const accountData = await this.getAccountData(assetContext, app, pubkey);
          accounts.push(accountData);
        }
      }
    }

    // Create report sections
    const sections = [
      {
        title: 'Account Overview',
        type: 'table' as const,
        data: {
          headers: ['Address', 'Available', 'Staked', 'Rewards', 'Unbonding', 'Total Value'],
          widths: ['25%', '15%', '15%', '15%', '15%', '15%'],
          rows: accounts.map(acc => [
            { text: this.truncateAddress(acc.address), fontSize: 9 },
            `${acc.balance} ${assetContext.symbol}`,
            `${acc.stakedAmount || '0'} ${assetContext.symbol}`,
            `${acc.rewards || '0'} ${assetContext.symbol}`,
            `${acc.unbondingAmount || '0'} ${assetContext.symbol}`,
            `${this.calculateTotalValue(acc)} ${assetContext.symbol}`
          ])
        }
      },
      {
        title: 'Staking Summary',
        type: 'summary' as const,
        data: this.getStakingSummary(accounts, assetContext.symbol)
      }
    ];

    // Add delegation details if present
    const delegations = this.getAllDelegations(accounts);
    if (delegations.length > 0) {
      sections.push({
        title: 'Delegation Details',
        type: 'table' as const,
        data: {
          headers: ['Validator', 'Amount', 'Address'],
          widths: ['40%', '30%', '30%'],
          rows: delegations.map(d => [
            d.validator,
            `${d.amount} ${assetContext.symbol}`,
            { text: this.truncateAddress(d.address), fontSize: 8 }
          ])
        }
      });
    }

    sections.push({
      title: 'Chain Information',
      type: 'list' as const,
      data: [
        `Chain: ${assetContext.name || 'Cosmos'}`,
        `Network ID: ${assetContext.networkId}`,
        `Native Token: ${assetContext.symbol}`,
        `Total Accounts: ${accounts.length}`,
        `Report Generated: ${this.getCurrentDate()}`
      ]
    });

    sections.push({
      title: 'Staking Notes',
      type: 'list' as const,
      data: [
        'Staked amounts are delegated to validators and earn rewards',
        'Unbonding period typically takes 21 days',
        'Rewards should be claimed periodically to compound earnings',
        'Redelegation allows moving stake between validators without unbonding'
      ]
    });

    return {
      title: `${assetContext.name} Staking Report`,
      subtitle: `${assetContext.symbol} Account Analysis`,
      generatedDate: this.getCurrentDate(),
      chain: assetContext.symbol, // Added for consistency with e2e tests
      lod: options.lod || options.lodLevel || 1, // Added for consistency with e2e tests
      sections
    };
  }

  private async getAccountData(assetContext: any, app: any, pubkey: any): Promise<CosmosAccountData> {
    const address = pubkey.address;
    let balance = '0';
    let stakedAmount = '0';
    let rewards = '0';
    let unbondingAmount = '0';
    let delegations: any[] = [];

    // Get balance from pubkey data
    if (pubkey.balances && pubkey.balances.length > 0) {
      const nativeBalance = pubkey.balances.find((b: any) => 
        b.asset === assetContext.symbol || b.ticker === assetContext.symbol
      );
      if (nativeBalance) {
        balance = this.formatBalance(nativeBalance.balance || '0', 6); // Cosmos uses 6 decimals
      }
    }

    // Check for staking data in pubkey
    if (pubkey.staking) {
      stakedAmount = this.formatBalance(pubkey.staking.staked || '0', 6);
      rewards = this.formatBalance(pubkey.staking.rewards || '0', 6);
      unbondingAmount = this.formatBalance(pubkey.staking.unbonding || '0', 6);
      
      if (pubkey.staking.delegations) {
        delegations = pubkey.staking.delegations.map((d: any) => ({
          validator: d.validator || 'Unknown Validator',
          amount: this.formatBalance(d.amount || '0', 6)
        }));
      }
    }

    // Try to get additional staking data from app context
    if (app?.pioneer && address) {
      try {
        // This would depend on Pioneer API capabilities for Cosmos chains
        // For now, we'll use what's available in the pubkey data
      } catch (e) {
        console.error('Error getting Cosmos account data:', e);
      }
    }

    return {
      address,
      balance,
      stakedAmount,
      rewards,
      unbondingAmount,
      delegations
    };
  }

  private truncateAddress(address: string): string {
    if (address.length <= 20) return address;
    return `${address.substring(0, 12)}...${address.substring(address.length - 8)}`;
  }

  private calculateTotalValue(account: CosmosAccountData): string {
    const available = parseFloat(account.balance || '0');
    const staked = parseFloat(account.stakedAmount || '0');
    const rewards = parseFloat(account.rewards || '0');
    const unbonding = parseFloat(account.unbondingAmount || '0');
    
    const total = available + staked + rewards + unbonding;
    return total.toFixed(6);
  }

  private getStakingSummary(accounts: CosmosAccountData[], symbol: string): string[] {
    const totalAvailable = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || '0'), 0);
    const totalStaked = accounts.reduce((sum, acc) => sum + parseFloat(acc.stakedAmount || '0'), 0);
    const totalRewards = accounts.reduce((sum, acc) => sum + parseFloat(acc.rewards || '0'), 0);
    const totalUnbonding = accounts.reduce((sum, acc) => sum + parseFloat(acc.unbondingAmount || '0'), 0);
    const totalValue = totalAvailable + totalStaked + totalRewards + totalUnbonding;
    
    const stakingRatio = totalValue > 0 ? ((totalStaked / totalValue) * 100).toFixed(2) : '0';
    
    return [
      `Total Available: ${totalAvailable.toFixed(6)} ${symbol}`,
      `Total Staked: ${totalStaked.toFixed(6)} ${symbol}`,
      `Total Rewards: ${totalRewards.toFixed(6)} ${symbol}`,
      `Total Unbonding: ${totalUnbonding.toFixed(6)} ${symbol}`,
      `Total Portfolio Value: ${totalValue.toFixed(6)} ${symbol}`,
      `Staking Ratio: ${stakingRatio}%`
    ];
  }

  private getAllDelegations(accounts: CosmosAccountData[]): any[] {
    const allDelegations: any[] = [];
    
    accounts.forEach(acc => {
      if (acc.delegations) {
        acc.delegations.forEach(d => {
          allDelegations.push({
            validator: d.validator,
            amount: d.amount,
            address: acc.address
          });
        });
      }
    });
    
    return allDelegations;
  }
}