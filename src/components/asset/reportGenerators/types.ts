// Base types for report generation
export interface ReportOptions {
  accountCount?: number;
  includeTransactions?: boolean;
  includeAddresses?: boolean;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

export interface ReportData {
  title: string;
  subtitle: string;
  generatedDate: string;
  sections: ReportSection[];
}

export interface ReportSection {
  title: string;
  type: 'table' | 'summary' | 'list' | 'text';
  data: any;
}

export interface BaseReportGenerator {
  generateReport(assetContext: any, app: any, options: ReportOptions): Promise<ReportData>;
  isSupported(assetContext: any): boolean;
  getDefaultOptions(): ReportOptions;
}

// Network types
export type NetworkType = 'utxo' | 'evm' | 'cosmos' | 'thorchain' | 'maya' | 'ripple' | 'binance';

// UTXO specific types
export interface XPUBData {
  account: number;
  type: string;
  xpub: string;
  derivationPath: string;
  receiveIndex: number;
  changeIndex: number;
  balance: string;
  totalReceived: string;
  totalSent: string;
  txCount: number;
}

// EVM specific types
export interface EVMAccountData {
  address: string;
  balance: string;
  nonce: number;
  tokenBalances?: Array<{
    symbol: string;
    balance: string;
    contractAddress: string;
  }>;
  transactionCount: number;
}

// Cosmos specific types
export interface CosmosAccountData {
  address: string;
  balance: string;
  stakedAmount?: string;
  rewards?: string;
  unbondingAmount?: string;
  delegations?: Array<{
    validator: string;
    amount: string;
  }>;
}