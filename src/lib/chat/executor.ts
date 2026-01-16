/**
 * Chat Function Executor
 *
 * Orchestrates the execution of chat assistant functions based on intent and parameters
 */

import { FUNCTION_REGISTRY, FunctionName, FunctionResult } from './functions';

// ============================================================================
// Type Definitions
// ============================================================================

export interface IntentResult {
  intent: string;
  functions: string[];
  parameters?: Record<string, any>;
  content: string;
}

export interface ExecutionResult {
  success: boolean;
  results: Array<{
    function: string;
    result: FunctionResult;
  }>;
  message: string;
  data?: any;
}

// ============================================================================
// Function Execution
// ============================================================================

/**
 * Execute a single function by name
 */
async function executeFunction(
  functionName: string,
  parameters: Record<string, any>,
  app: any
): Promise<FunctionResult> {
  // Check if function exists in registry
  if (!(functionName in FUNCTION_REGISTRY)) {
    return {
      success: false,
      message: `Unknown function: ${functionName}`,
    };
  }

  const fn = FUNCTION_REGISTRY[functionName as FunctionName];

  try {
    // Execute function with appropriate parameters
    switch (functionName) {
      // Navigation functions
      case 'navigateToAsset':
        return await fn(parameters.caip, app);

      case 'navigateToSend':
      case 'navigateToReceive':
      case 'navigateToSwap':
        return await fn(parameters.caip, app);

      case 'navigateToDashboard':
        return await (fn as (app: any) => Promise<FunctionResult>)(app);

      // Query functions
      case 'getBalances':
      case 'getNetworks':
        return await (fn as (app: any) => Promise<FunctionResult>)(app);

      case 'searchAssets':
        return await fn(parameters.query || '', app);

      case 'getAddress':
        return await fn(parameters.asset || parameters.query || '', app);

      // Action functions
      case 'refreshPortfolio':
        return await (fn as (app: any) => Promise<FunctionResult>)(app);

      // Tutorial & Help functions
      case 'startTutorial':
      case 'getPageHelp':
        return await (fn as (app: any) => Promise<FunctionResult>)(app);

      case 'highlightElement':
      case 'explainElement':
        return await fn(parameters.elementId || parameters.element || '', app);

      case 'getProjectInfo':
        return await (fn as (topic: string) => Promise<FunctionResult>)(parameters.topic || parameters.query || '');

      // Capability & Intelligence functions
      case 'getChainCapability':
        return await (fn as (chain: string) => Promise<FunctionResult>)(parameters.query || parameters.chain || '');

      case 'getCAIPInfo':
        return await fn(parameters.query || parameters.asset || '', app);

      case 'getDeviceInfo':
        return await (fn as (app: any) => Promise<FunctionResult>)(app);

      case 'getVaultStatus':
        return await (fn as (app: any) => Promise<FunctionResult>)(app);

      case 'getSupportedChains':
        return await (fn as (app: any) => Promise<FunctionResult>)(app);

      // Path Intelligence functions
      case 'getPathsForBlockchain':
        return await fn(parameters.blockchain || parameters.query || '', app);

      case 'listConfiguredPaths':
        return await fn(parameters.blockchain || parameters.query, app);

      case 'getPathInfo':
        return await fn(parameters.path || parameters.query || '', app);

      case 'suggestPathForBlockchain':
        return await fn(parameters.blockchain || parameters.query || '', parameters.accountNumber || 0);

      default:
        return {
          success: false,
          message: `Function not implemented: ${functionName}`,
        };
    }
  } catch (error: any) {
    console.error(`Error executing ${functionName}:`, error);
    return {
      success: false,
      message: `Function execution failed: ${error.message}`,
    };
  }
}

/**
 * Execute multiple functions in sequence
 */
export async function executeChatFunctions(
  intent: string,
  functions: string[],
  parameters: Record<string, any> = {},
  app: any
): Promise<ExecutionResult> {
  const results: ExecutionResult['results'] = [];
  let finalData: any = null;

  try {
    // Special handling for navigation + search combos
    if (functions.includes('searchAssets') &&
        (functions.includes('navigateToAsset') ||
         functions.includes('navigateToSend') ||
         functions.includes('navigateToReceive') ||
         functions.includes('navigateToSwap'))) {
      // First, search for the asset
      const searchResult = await executeFunction('searchAssets', parameters, app);
      results.push({ function: 'searchAssets', result: searchResult });

      if (searchResult.success && searchResult.data?.results?.length > 0) {
        // Use the first search result
        const firstAsset = searchResult.data.results[0];
        parameters.caip = firstAsset.caip;
        finalData = { asset: firstAsset };

        // Debug logging
        //console.log('🔍 [Executor] Search found asset:', {
        //   query: parameters.query,
        //   symbol: firstAsset.symbol,
        //   name: firstAsset.name,
        //   caip: firstAsset.caip,
        //   totalResults: searchResult.data.results.length
        // });

        // Execute the navigation function
        const navFunction = functions.find(f =>
          f.startsWith('navigate') && f !== 'navigateToDashboard'
        );

        if (navFunction) {
          //console.log('🔍 [Executor] Executing navigation:', navFunction, 'with CAIP:', parameters.caip);
          const navResult = await executeFunction(navFunction, parameters, app);
          results.push({ function: navFunction, result: navResult });
        }
      } else {
        // Asset not found
        return {
          success: false,
          results,
          message: `Could not find asset matching "${parameters.query}"`,
        };
      }
    } else {
      // Normal execution: run each function in sequence
      for (const functionName of functions) {
        const result = await executeFunction(functionName, parameters, app);
        results.push({ function: functionName, result });

        // Store data from successful functions
        if (result.success && result.data) {
          finalData = { ...finalData, ...result.data };
        }

        // Stop execution if a function fails (unless it's optional)
        if (!result.success && !isOptionalFunction(functionName)) {
          break;
        }
      }
    }

    // Aggregate results
    const allSuccessful = results.every(r => r.result.success);
    const messages = results
      .map(r => r.result.message)
      .filter(m => m)
      .join('\n');

    return {
      success: allSuccessful,
      results,
      message: messages || 'Execution completed',
      data: finalData,
    };
  } catch (error: any) {
    console.error('Function execution error:', error);
    return {
      success: false,
      results,
      message: `Execution failed: ${error.message}`,
    };
  }
}

/**
 * Check if a function is optional (execution continues even if it fails)
 */
function isOptionalFunction(functionName: string): boolean {
  const optionalFunctions = ['searchAssets'];
  return optionalFunctions.includes(functionName);
}

/**
 * Generate a user-friendly response from execution results
 */
export function formatExecutionResponse(
  intentResult: IntentResult,
  executionResult: ExecutionResult
): string {
  // If execution failed, return the error message
  if (!executionResult.success) {
    return `Sorry, I encountered an error: ${executionResult.message}`;
  }

  // Use the AI-generated content as the base response
  let response = intentResult.content;

  // Add data-specific details based on intent
  switch (intentResult.intent) {
    case 'query_balance':
      if (executionResult.data?.balances) {
        const balances = executionResult.data.balances;
        const totalValueUsd = executionResult.data.totalValueUsd || 0;

        if (balances.length === 0) {
          response += '\n\nYou currently have no balances.';
        } else {
          const topBalances = balances
            .filter((b: any) => parseFloat(b.valueUsd || 0) > 0)
            .sort((a: any, b: any) => parseFloat(b.valueUsd || 0) - parseFloat(a.valueUsd || 0))
            .slice(0, 5);

          response += `\n\nYour total portfolio value is $${totalValueUsd.toFixed(2)}.`;

          if (topBalances.length > 0) {
            response += '\n\nTop assets:';
            topBalances.forEach((b: any) => {
              response += `\n• ${b.symbol}: ${b.balance} ($${parseFloat(b.valueUsd || 0).toFixed(2)})`;
            });
          }
        }
      }
      break;

    case 'query_network':
      if (executionResult.data?.networks) {
        const networks = executionResult.data.networks;

        if (networks.length === 0) {
          response += '\n\nNo networks configured yet.';
        } else {
          response += `\n\nYou have ${networks.length} networks configured:`;
          networks.slice(0, 10).forEach((n: any) => {
            const value = n.totalValueUsd > 0 ? ` ($${n.totalValueUsd.toFixed(2)})` : ' (no balance)';
            response += `\n• ${n.symbol}${value}`;
          });
        }
      }
      break;

    case 'query_address':
      if (executionResult.data?.address) {
        response += `\n\nAddress: ${executionResult.data.address}`;
      }
      break;

    case 'query_caip':
    case 'query_capability':
    case 'query_status':
    case 'query_path':
      // For these intents, the function result message IS the complete response
      // Replace the AI placeholder with the actual function result
      if (executionResult.results && executionResult.results.length > 0) {
        const functionResult = executionResult.results[0].result;
        if (functionResult.message) {
          response = functionResult.message;
        }
      }
      break;
  }

  return response;
}

// ============================================================================
// System Prompt - NOW HANDLED SERVER-SIDE
// ============================================================================
// The system prompt has been moved to the server-side /supportChat endpoint
// for better security and privacy. It uses Venice.ai with the qwen3-4b model.
// See: pioneer-server-v2/services/rest/src/controllers/2-intelligence.controller.ts
//
// This export is kept for backward compatibility with tests only.
// Production code should NOT send system prompts from the client.
// ============================================================================

export const CHAT_SYSTEM_PROMPT = `[DEPRECATED - System prompt now server-side]
You are a KeepKey Vault assistant. Analyze the user's message and return JSON:

{
  "intent": "<intent_type>",
  "functions": ["<function_name>", ...],
  "parameters": { "<param>": "<value>", ... },
  "content": "<response_text>"
}

**Intent Types**:
- query_balance: User wants to see balances
- query_network: User wants network information
- query_address: User wants to see an address
- action_send: User wants to send assets
- action_receive: User wants to receive assets
- action_swap: User wants to swap assets
- action_refresh: User wants to refresh data
- navigation: User wants to navigate to a page
- security_warning: User is asking for sensitive information (NEVER provide private keys!)
- general: General help or conversation

**Available Functions**:
Navigation: navigateToAsset, navigateToSend, navigateToReceive, navigateToSwap, navigateToDashboard
Queries: getBalances, searchAssets, getNetworks, getAddress
Actions: refreshPortfolio

**Security Rules**:
- NEVER provide private keys, seed phrases, or sensitive credentials
- For security queries, return security_warning intent with educational response
- For send/swap actions, guide users through the UI (don't execute automatically)

**IMPORTANT Navigation Rules**:
- For "How do I send X?" → use searchAssets + navigateToSend to open the send page for that asset
- For "Show me how to receive X" → use searchAssets + navigateToReceive to open the receive page
- For "I want to swap X" → use searchAssets + navigateToSwap to open the swap page
- For "Show me X" → use searchAssets + navigateToAsset to open the asset details page
- Always search for the asset first, then navigate with the CAIP identifier

**Examples**:

User: "What's my Bitcoin balance?"
{
  "intent": "query_balance",
  "functions": ["searchAssets", "getBalances"],
  "parameters": { "query": "bitcoin" },
  "content": "Let me check your Bitcoin balance..."
}

User: "Show me my Ethereum"
{
  "intent": "navigation",
  "functions": ["searchAssets", "navigateToAsset"],
  "parameters": { "query": "ethereum" },
  "content": "Opening your Ethereum asset page..."
}

User: "How do I send Bitcoin?"
{
  "intent": "action_send",
  "functions": ["searchAssets", "navigateToSend"],
  "parameters": { "query": "bitcoin" },
  "content": "I'll open the Bitcoin send page for you. You'll be able to enter the recipient address and amount there."
}

User: "How do I receive ETH?"
{
  "intent": "action_receive",
  "functions": ["searchAssets", "navigateToReceive"],
  "parameters": { "query": "ethereum" },
  "content": "I'll show you your Ethereum receiving address with a QR code..."
}

User: "What's my private key?"
{
  "intent": "security_warning",
  "functions": [],
  "parameters": {},
  "content": "I cannot and will never show private keys or seed phrases. Your private keys are stored securely on your KeepKey device and should never be shared or displayed. This is critical for your security."
}

User: "Refresh my portfolio"
{
  "intent": "action_refresh",
  "functions": ["refreshPortfolio"],
  "parameters": {},
  "content": "Refreshing your portfolio data..."
}

User: "Go back to dashboard"
{
  "intent": "navigation",
  "functions": ["navigateToDashboard"],
  "parameters": {},
  "content": "Returning to the dashboard..."
}`;
