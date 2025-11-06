/**
 * Page Context & Navigation System
 *
 * Provides comprehensive descriptions of all pages and UI elements in the KeepKey Vault
 * for the AI chat assistant to understand and guide users through the application.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface UIElement {
  id: string;
  name: string;
  description: string;
  location: string; // CSS selector or description
  type: 'button' | 'input' | 'card' | 'section' | 'link' | 'chart';
  action?: string; // What happens when clicked/interacted with
}

export interface PageContext {
  id: string;
  name: string;
  path: string; // URL path pattern
  description: string;
  purpose: string;
  keyFeatures: string[];
  elements: UIElement[];
  tutorialSteps?: TutorialStep[];
}

export interface TutorialStep {
  order: number;
  title: string;
  description: string;
  elementId?: string; // ID of element to highlight
  action?: string; // User action to perform
  nextStep?: string; // What happens after this step
}

// ============================================================================
// Dashboard Page Context
// ============================================================================

export const DASHBOARD_PAGE: PageContext = {
  id: 'dashboard',
  name: 'Portfolio Dashboard',
  path: '/',
  description: 'Your home base for managing your entire cryptocurrency portfolio. See everything at a glance - total value, asset distribution, and quick access to all your holdings.',
  purpose: 'View total portfolio value, asset distribution, and navigate to specific assets',
  keyFeatures: [
    'See your total portfolio value in USD with live updates',
    'Visualize asset allocation with an interactive donut chart',
    'View all blockchains you\'re using and their balances',
    'Access your top assets sorted by value',
    'Click any asset to view details, send, receive, or swap',
    'Ask me questions about your portfolio anytime'
  ],
  elements: [
    {
      id: 'total-portfolio-value',
      name: 'Total Portfolio Value',
      description: 'Large USD amount showing your total holdings across all assets',
      location: 'Center top of page, below KeepKey logo',
      type: 'section',
      action: 'Displays real-time portfolio value with animated counter'
    },
    {
      id: 'donut-chart',
      name: 'Asset Allocation Chart',
      description: 'Interactive donut chart showing percentage breakdown of assets',
      location: 'Center of page',
      type: 'chart',
      action: 'Hover over slices to see asset details, click to navigate to asset page'
    },
    {
      id: 'network-cards',
      name: 'Network Cards',
      description: 'Grid of blockchain networks with icons, symbols, and USD values',
      location: 'Below the donut chart',
      type: 'card',
      action: 'Each card shows network balance and can be clicked to view assets on that network'
    },
    {
      id: 'top-assets-list',
      name: 'Top Assets List',
      description: 'Scrollable list of your assets sorted by USD value',
      location: 'Right side of donut chart',
      type: 'section',
      action: 'Click any asset to navigate to its detail page'
    },
    {
      id: 'refresh-button',
      name: 'Refresh Portfolio',
      description: 'Button to manually refresh portfolio data from blockchain',
      location: 'Top right corner',
      type: 'button',
      action: 'Fetches latest balance and price data for all assets'
    },
    {
      id: 'settings-button',
      name: 'Settings',
      description: 'Access application settings and preferences',
      location: 'Top right corner',
      type: 'button',
      action: 'Opens settings dialog for configuration'
    },
    {
      id: 'chat-bubble',
      name: 'Chat Assistant',
      description: 'AI-powered chat assistant for portfolio queries and navigation',
      location: 'Bottom right corner (floating)',
      type: 'button',
      action: 'Opens chat interface to ask questions about your portfolio'
    }
  ],
  tutorialSteps: [
    {
      order: 1,
      title: 'Welcome to Your Portfolio',
      description: 'This is your portfolio dashboard. The large number at the top shows your total holdings in USD across all cryptocurrencies.',
      elementId: 'total-portfolio-value'
    },
    {
      order: 2,
      title: 'Asset Distribution',
      description: 'The donut chart visualizes how your portfolio is distributed across different assets. Hover over any slice to see details, or click to navigate to that asset.',
      elementId: 'donut-chart',
      action: 'Hover over chart slices to explore'
    },
    {
      order: 3,
      title: 'Network Breakdown',
      description: 'These cards show your holdings on each blockchain network (Bitcoin, Ethereum, etc.). Each card displays the network symbol, total balance, and USD value.',
      elementId: 'network-cards',
      action: 'Click a network card to view assets on that blockchain'
    },
    {
      order: 4,
      title: 'Top Assets',
      description: 'This list shows your top assets by value. Click any asset to view details, send, receive, or swap.',
      elementId: 'top-assets-list',
      action: 'Click an asset to open its detail page'
    },
    {
      order: 5,
      title: 'Chat Assistant',
      description: 'Click here anytime to chat with me! I can help you check balances, navigate to assets, and explain features.',
      elementId: 'chat-bubble',
      action: 'Click to open chat',
      nextStep: 'Try asking: "Show me my Bitcoin" or "What\'s my total balance?"'
    }
  ]
};

// ============================================================================
// Asset Detail Page Context
// ============================================================================

export const ASSET_PAGE: PageContext = {
  id: 'asset-detail',
  name: 'Asset Detail Page',
  path: '/asset/:caip',
  description: 'Everything you need to manage this specific cryptocurrency. View your balance, manage addresses, and take action - all in one place.',
  purpose: 'View asset balance, addresses, transaction history, and perform send/receive/swap operations',
  keyFeatures: [
    'See your balance and current USD value',
    'Manage multiple addresses for enhanced privacy',
    'Send crypto to others securely',
    'Receive crypto with QR codes',
    'Swap for other cryptocurrencies',
    'View transaction history and address details'
  ],
  elements: [
    {
      id: 'back-button',
      name: 'Back to Dashboard',
      description: 'Navigate back to portfolio dashboard',
      location: 'Top left corner',
      type: 'button',
      action: 'Returns to main dashboard view'
    },
    {
      id: 'asset-header',
      name: 'Asset Header',
      description: 'Shows asset icon, name, symbol, and current balance',
      location: 'Top center of page',
      type: 'section',
      action: 'Displays asset identification and total balance'
    },
    {
      id: 'asset-value-usd',
      name: 'USD Value',
      description: 'Total value of this asset in USD',
      location: 'Below asset name',
      type: 'section',
      action: 'Shows USD value with animated counter on balance changes'
    },
    {
      id: 'send-button',
      name: 'Send',
      description: 'Initiate a send transaction',
      location: 'Action buttons row, left',
      type: 'button',
      action: 'Opens send form to transfer this asset to another address'
    },
    {
      id: 'receive-button',
      name: 'Receive',
      description: 'View receiving address and QR code',
      location: 'Action buttons row, center-left',
      type: 'button',
      action: 'Shows your address for receiving this asset with QR code'
    },
    {
      id: 'swap-button',
      name: 'Swap',
      description: 'Exchange this asset for another cryptocurrency',
      location: 'Action buttons row, center-right',
      type: 'button',
      action: 'Opens swap interface to exchange with other assets'
    },
    {
      id: 'refresh-button',
      name: 'Refresh Balance',
      description: 'Update asset balance from blockchain',
      location: 'Action buttons row, right',
      type: 'button',
      action: 'Fetches latest balance data for this asset'
    },
    {
      id: 'balance-distribution',
      name: 'Balance Distribution',
      description: 'Shows balance breakdown across different addresses/accounts',
      location: 'Below action buttons',
      type: 'section',
      action: 'Click addresses to view details or copy'
    },
    {
      id: 'add-path-button',
      name: 'Add New Address',
      description: 'Generate a new address/path for this asset',
      location: 'Balance distribution section',
      type: 'button',
      action: 'Opens dialog to create new derivation path'
    },
    {
      id: 'pubkey-list',
      name: 'Address List',
      description: 'List of all addresses/accounts for this asset with balances',
      location: 'Collapsible section below balance distribution',
      type: 'section',
      action: 'View and manage multiple addresses for this asset'
    }
  ],
  tutorialSteps: [
    {
      order: 1,
      title: 'Asset Overview',
      description: 'This page shows everything about a specific asset. At the top, you see the asset name, symbol, and your current balance.',
      elementId: 'asset-header'
    },
    {
      order: 2,
      title: 'Primary Actions',
      description: 'Use these buttons to Send (transfer to someone), Receive (get your address), or Swap (exchange for another crypto).',
      elementId: 'send-button',
      action: 'Click any button to perform that action'
    },
    {
      order: 3,
      title: 'Balance Distribution',
      description: 'Your balance might be spread across multiple addresses. This section shows each address and how much is in it.',
      elementId: 'balance-distribution',
      action: 'Click an address to copy it'
    },
    {
      order: 4,
      title: 'Managing Addresses',
      description: 'You can add new addresses for privacy or organization. Each address can have its own balance.',
      elementId: 'add-path-button',
      action: 'Click to create a new address'
    }
  ]
};

// ============================================================================
// Send Page Context
// ============================================================================

export const SEND_PAGE: PageContext = {
  id: 'send-transaction',
  name: 'Send Cryptocurrency',
  path: '/asset/:caip?view=send',
  description: 'Ready to send crypto to someone? Enter their address, choose your amount and fee, then confirm with your KeepKey device. It\'s secure and straightforward.',
  purpose: 'Create and broadcast a cryptocurrency transaction to send assets',
  keyFeatures: [
    'Enter recipient address (validates automatically)',
    'Choose amount to send (or click "Max" for everything)',
    'Select network fee (Slow/Normal/Fast)',
    'Preview transaction details before confirming',
    'Sign securely with your KeepKey device',
    'Track broadcast and confirmation'
  ],
  elements: [
    {
      id: 'recipient-input',
      name: 'Recipient Address',
      description: 'Input field for destination address',
      location: 'Top of send form',
      type: 'input',
      action: 'Enter the address to send to (validates format)'
    },
    {
      id: 'amount-input',
      name: 'Amount',
      description: 'Input field for amount to send',
      location: 'Below recipient input',
      type: 'input',
      action: 'Enter amount to send with USD value shown below'
    },
    {
      id: 'max-button',
      name: 'Max Button',
      description: 'Automatically fill maximum sendable amount',
      location: 'Right side of amount input',
      type: 'button',
      action: 'Calculates and fills max amount minus fees'
    },
    {
      id: 'fee-selector',
      name: 'Network Fee',
      description: 'Choose transaction speed and fee level',
      location: 'Below amount input',
      type: 'section',
      action: 'Select Slow (cheapest), Normal, or Fast (most expensive)'
    },
    {
      id: 'memo-input',
      name: 'Memo (Optional)',
      description: 'Optional message or note for transaction',
      location: 'Below fee selector',
      type: 'input',
      action: 'Add a memo if supported by the blockchain'
    },
    {
      id: 'review-button',
      name: 'Review Transaction',
      description: 'Preview transaction before signing',
      location: 'Bottom of form',
      type: 'button',
      action: 'Shows transaction details for final review'
    },
    {
      id: 'sign-button',
      name: 'Sign & Send',
      description: 'Sign transaction with hardware device and broadcast',
      location: 'Review screen',
      type: 'button',
      action: 'Prompts device to sign, then broadcasts to network'
    }
  ],
  tutorialSteps: [
    {
      order: 1,
      title: 'Recipient Address',
      description: 'First, enter the recipient\'s address. Make sure it\'s correct - crypto transactions cannot be reversed!',
      elementId: 'recipient-input',
      action: 'Paste or type the destination address'
    },
    {
      order: 2,
      title: 'Amount to Send',
      description: 'Enter how much you want to send. Click "Max" to send your entire balance minus fees.',
      elementId: 'amount-input',
      action: 'Enter amount or click Max'
    },
    {
      order: 3,
      title: 'Network Fee',
      description: 'Choose your fee level: Slow (cheaper, takes longer), Normal (balanced), or Fast (expensive, quick confirmation).',
      elementId: 'fee-selector',
      action: 'Select fee level based on urgency'
    },
    {
      order: 4,
      title: 'Review & Sign',
      description: 'Click Review to see transaction details. If everything looks good, click Sign & Send to complete the transaction with your KeepKey device.',
      elementId: 'review-button',
      action: 'Review transaction details'
    }
  ]
};

// ============================================================================
// Receive Page Context
// ============================================================================

export const RECEIVE_PAGE: PageContext = {
  id: 'receive-address',
  name: 'Receive Cryptocurrency',
  path: '/asset/:caip?view=receive',
  description: 'Share your address to receive crypto! Copy it, share the QR code, or verify on your KeepKey device for extra security.',
  purpose: 'Show address to receive assets with QR code for easy scanning',
  keyFeatures: [
    'Display your receiving address',
    'Show QR code for easy scanning',
    'Copy address with one click',
    'Verify address on your KeepKey device',
    'Switch between multiple addresses',
    'See address derivation path details'
  ],
  elements: [
    {
      id: 'qr-code',
      name: 'QR Code',
      description: 'Scannable QR code of receiving address',
      location: 'Center of page',
      type: 'section',
      action: 'Others can scan this with their wallet to send to you'
    },
    {
      id: 'address-display',
      name: 'Address',
      description: 'Your receiving address in text form',
      location: 'Below QR code',
      type: 'section',
      action: 'Click to copy address to clipboard'
    },
    {
      id: 'copy-button',
      name: 'Copy Address',
      description: 'Copy address to clipboard',
      location: 'Next to address',
      type: 'button',
      action: 'Copies address for pasting into another app'
    },
    {
      id: 'verify-button',
      name: 'Verify on Device',
      description: 'Display address on KeepKey device for verification',
      location: 'Below address',
      type: 'button',
      action: 'Shows address on hardware device to confirm it matches'
    },
    {
      id: 'address-selector',
      name: 'Address Selector',
      description: 'Choose which address/account to display',
      location: 'Top of page',
      type: 'section',
      action: 'Switch between different addresses for this asset'
    }
  ],
  tutorialSteps: [
    {
      order: 1,
      title: 'Your Receiving Address',
      description: 'This is your address for receiving this cryptocurrency. Share it with others to receive payments.',
      elementId: 'address-display',
      action: 'Click the copy button to copy your address'
    },
    {
      order: 2,
      title: 'QR Code',
      description: 'Others can scan this QR code with their wallet app to send crypto to you instantly.',
      elementId: 'qr-code',
      action: 'Show this QR code to sender'
    },
    {
      order: 3,
      title: 'Verify on Device',
      description: 'For extra security, you can verify this address on your KeepKey device to ensure it hasn\'t been tampered with.',
      elementId: 'verify-button',
      action: 'Click to verify address on KeepKey'
    }
  ]
};

// ============================================================================
// Swap Page Context
// ============================================================================

export const SWAP_PAGE: PageContext = {
  id: 'swap-exchange',
  name: 'Swap Cryptocurrencies',
  path: '/asset/:caip?view=swap',
  description: 'Exchange one crypto for another directly from your wallet! We compare rates across multiple decentralized exchanges to get you the best deal.',
  purpose: 'Swap between different cryptocurrencies using decentralized exchanges',
  keyFeatures: [
    'Choose which crypto to swap from and to',
    'Enter amount and see estimated output',
    'Compare live rates from THORChain, Maya, and more',
    'See fees and slippage before confirming',
    'Execute swap securely with your KeepKey',
    'Track swap progress and completion'
  ],
  elements: [
    {
      id: 'from-asset',
      name: 'From Asset',
      description: 'Asset you are swapping from',
      location: 'Top of swap form',
      type: 'section',
      action: 'Shows current asset and balance'
    },
    {
      id: 'to-asset',
      name: 'To Asset',
      description: 'Asset you want to receive',
      location: 'Middle of swap form',
      type: 'section',
      action: 'Click to select destination asset'
    },
    {
      id: 'from-amount',
      name: 'From Amount',
      description: 'Amount to swap',
      location: 'From asset section',
      type: 'input',
      action: 'Enter amount to swap (updates quote)'
    },
    {
      id: 'to-amount',
      name: 'To Amount',
      description: 'Estimated amount to receive',
      location: 'To asset section',
      type: 'section',
      action: 'Shows estimated output based on current rates'
    },
    {
      id: 'swap-quotes',
      name: 'Swap Quotes',
      description: 'List of available exchange rates from different protocols',
      location: 'Below asset selection',
      type: 'section',
      action: 'Compare rates across THORChain, Maya, etc.'
    },
    {
      id: 'execute-swap',
      name: 'Execute Swap',
      description: 'Confirm and execute the swap transaction',
      location: 'Bottom of form',
      type: 'button',
      action: 'Signs transaction and executes swap'
    }
  ],
  tutorialSteps: [
    {
      order: 1,
      title: 'Select Assets',
      description: 'Choose what you want to swap from (top) and what you want to receive (bottom).',
      elementId: 'from-asset',
      action: 'Click to change assets'
    },
    {
      order: 2,
      title: 'Enter Amount',
      description: 'Type how much you want to swap. The output amount will update automatically with the current exchange rate.',
      elementId: 'from-amount',
      action: 'Enter swap amount'
    },
    {
      order: 3,
      title: 'Compare Quotes',
      description: 'We fetch rates from multiple protocols (THORChain, Maya, etc.) so you get the best deal.',
      elementId: 'swap-quotes',
      action: 'Review available quotes'
    },
    {
      order: 4,
      title: 'Execute Swap',
      description: 'When you\'re happy with the rate, click here to sign the transaction with your KeepKey and execute the swap.',
      elementId: 'execute-swap',
      action: 'Click to complete swap'
    }
  ]
};

// ============================================================================
// Settings Page Context
// ============================================================================

export const SETTINGS_PAGE: PageContext = {
  id: 'settings',
  name: 'Settings',
  path: '/settings',
  description: 'Customize your KeepKey Vault experience. Manage which blockchains you use, pair devices, and configure advanced features.',
  purpose: 'Configure wallet settings, manage devices, and customize preferences',
  keyFeatures: [
    'Enable or disable blockchain networks',
    'Pair and manage your KeepKey devices',
    'Toggle experimental features',
    'Configure privacy and security options',
    'Customize display preferences',
    'View version information and support links'
  ],
  elements: [
    {
      id: 'network-settings',
      name: 'Network Settings',
      description: 'Enable/disable blockchain networks',
      location: 'Main settings panel',
      type: 'section',
      action: 'Toggle networks on/off to customize which chains to use'
    },
    {
      id: 'device-management',
      name: 'Device Management',
      description: 'View and manage connected KeepKey devices',
      location: 'Settings panel',
      type: 'section',
      action: 'See device status, pair new devices, unpair devices'
    },
    {
      id: 'feature-flags',
      name: 'Feature Flags',
      description: 'Enable experimental features',
      location: 'Advanced settings',
      type: 'section',
      action: 'Toggle beta features on/off'
    }
  ]
};

// ============================================================================
// Registry of All Pages
// ============================================================================

export const PAGE_REGISTRY: Record<string, PageContext> = {
  dashboard: DASHBOARD_PAGE,
  asset: ASSET_PAGE,
  send: SEND_PAGE,
  receive: RECEIVE_PAGE,
  swap: SWAP_PAGE,
  settings: SETTINGS_PAGE,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect current page based on URL path
 */
export function detectCurrentPage(pathname: string): PageContext | null {
  // Dashboard
  if (pathname === '/' || pathname === '') {
    return DASHBOARD_PAGE;
  }

  // Asset pages
  if (pathname.startsWith('/asset/')) {
    const searchParams = new URLSearchParams(window.location.search);
    const view = searchParams.get('view');

    if (view === 'send') return SEND_PAGE;
    if (view === 'receive') return RECEIVE_PAGE;
    if (view === 'swap') return SWAP_PAGE;

    return ASSET_PAGE;
  }

  // Settings
  if (pathname === '/settings') {
    return SETTINGS_PAGE;
  }

  return null;
}

/**
 * Get tutorial for current page
 */
export function getCurrentPageTutorial(pathname: string): TutorialStep[] | null {
  const page = detectCurrentPage(pathname);
  return page?.tutorialSteps || null;
}

/**
 * Find UI element by ID across all pages
 */
export function findElement(elementId: string): { page: PageContext; element: UIElement } | null {
  for (const page of Object.values(PAGE_REGISTRY)) {
    const element = page.elements.find(el => el.id === elementId);
    if (element) {
      return { page, element };
    }
  }
  return null;
}

/**
 * Get context-aware help text for current page
 */
export function getPageHelpText(pathname: string): string {
  const page = detectCurrentPage(pathname);

  if (!page) {
    return 'I can help you navigate the KeepKey Vault. Ask me about your portfolio, balances, or how to use any feature!';
  }

  return `You're on the ${page.name}. ${page.description}\n\nKey features:\n${page.keyFeatures.map(f => `• ${f}`).join('\n')}\n\nAsk me anything about this page or say "tutorial" to start a guided tour!`;
}
