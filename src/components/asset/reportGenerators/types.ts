// Base types for report generation
export interface ReportOptions {
  accountCount?: number;
  includeTransactions?: boolean;
  includeAddresses?: boolean;
  lod?: number; // Level of Detail: 0-5 (renamed from lodLevel for consistency with e2e)
  lodLevel?: number; // @deprecated - use lod instead (kept for backward compatibility)
  gapLimit?: number; // For LOD address discovery
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

export interface ReportData {
  title: string;
  subtitle: string;
  generatedDate: string;
  chain?: string; // Chain symbol (e.g., 'BTC', 'ETH') - synced with e2e tests
  lod?: number; // Level of detail used to generate this report - synced with e2e tests
  sections: ReportSection[];
}

export interface ReportSection {
  title: string;
  type: 'table' | 'summary' | 'list' | 'text' | 'transactions' | 'xpub_details' | 'address_details'; // Extended types from e2e
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
  // LOD 5 specific fields
  addresses?: AddressData[];
}

export interface AddressData {
  address: string;
  path: string;
  index: number;
  type: 'receive' | 'change';
  balance: string;
  txCount: number;
  transactions?: TransactionData[];
}

export interface TransactionData {
  txid: string;
  blockHeight: number;
  timestamp: string;
  value: number;
  confirmations: number;
  inputs: TransactionIO[];
  outputs: TransactionIO[];
  fee: number;
  category: 'send' | 'receive' | 'self';
  llmSummary?: string;
  counterparties?: string[];
}

export interface TransactionIO {
  address: string;
  value: number;
  isOwn: boolean;
  isChange: boolean;
  path?: string;
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