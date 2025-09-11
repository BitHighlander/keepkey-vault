import { BaseReportGenerator } from './BaseReportGenerator';
import { UTXOReportGenerator } from './UTXOReportGenerator';
import { EVMReportGenerator } from './EVMReportGenerator';
import { CosmosReportGenerator } from './CosmosReportGenerator';
import { GenericReportGenerator } from './GenericReportGenerator';

export class ReportGeneratorFactory {
  private static generators: BaseReportGenerator[] = [
    new UTXOReportGenerator(),
    new EVMReportGenerator(),
    new CosmosReportGenerator(),
    new GenericReportGenerator() // Fallback - should be last
  ];

  /**
   * Get the appropriate report generator for the given asset context
   */
  static getGenerator(assetContext: any): BaseReportGenerator {
    // Find the first generator that supports this asset
    for (const generator of this.generators) {
      if (generator.isSupported(assetContext)) {
        console.log(`Using ${generator.constructor.name} for ${assetContext.symbol}`);
        return generator;
      }
    }
    
    // This should never happen since GenericReportGenerator supports everything
    console.warn('No specific generator found, using generic generator');
    return new GenericReportGenerator();
  }

  /**
   * Register a custom report generator
   */
  static registerGenerator(generator: BaseReportGenerator, priority: number = -1): void {
    if (priority >= 0 && priority < this.generators.length - 1) {
      // Insert at specific position (but always keep Generic as last)
      this.generators.splice(priority, 0, generator);
    } else {
      // Add before the Generic generator
      this.generators.splice(this.generators.length - 1, 0, generator);
    }
  }

  /**
   * Get network type from asset context
   */
  static getNetworkType(assetContext: any): string {
    const networkId = assetContext?.networkId || '';
    const symbol = assetContext?.symbol || '';
    const chain = assetContext?.chain || '';
    
    if (networkId.startsWith('bip122:') || ['BTC', 'BCH', 'LTC', 'DOGE', 'DASH'].includes(symbol.toUpperCase())) {
      return 'UTXO';
    }
    
    if (networkId.startsWith('eip155:') || ['ETH', 'MATIC', 'BNB', 'AVAX'].includes(symbol.toUpperCase())) {
      return 'EVM';
    }
    
    if (networkId.startsWith('cosmos:') || chain.toLowerCase().includes('cosmos') || 
        ['ATOM', 'OSMO', 'JUNO'].includes(symbol.toUpperCase())) {
      return 'Cosmos';
    }
    
    if (networkId.includes('thorchain') || symbol.toUpperCase() === 'RUNE') {
      return 'THORChain';
    }
    
    if (networkId.includes('maya') || symbol.toUpperCase() === 'CACAO') {
      return 'Maya';
    }
    
    if (symbol.toUpperCase() === 'XRP') {
      return 'Ripple';
    }
    
    return 'Generic';
  }

  /**
   * Get a user-friendly description of what the report will contain
   */
  static getReportDescription(assetContext: any): string {
    const networkType = this.getNetworkType(assetContext);
    
    switch (networkType) {
      case 'UTXO':
        return 'Generate XPUB report with derivation paths, balances, and transaction history for all account types (Legacy, SegWit, Native SegWit)';
      
      case 'EVM':
        return 'Generate account report with addresses, balances, token holdings, and transaction counts';
      
      case 'Cosmos':
        return 'Generate staking report with account balances, delegations, rewards, and unbonding amounts';
      
      case 'THORChain':
      case 'Maya':
        return 'Generate liquidity provider report with pool positions, earnings, and impermanent loss calculations';
      
      default:
        return 'Generate account report with addresses and balance information';
    }
  }

  /**
   * Check if reports are supported for this asset
   */
  static isReportSupported(assetContext: any): boolean {
    // Reports are supported for all assets, but some have more detailed information
    return true;
  }
}