# Venice.ai Private Inference Endpoint - Implementation Plan

## Overview

Replace OpenAI ChatCompletion with Venice.ai for privacy-preserving inference in KeepKey Vault chat assistant.

## Privacy Benefits

**Venice.ai Advantages:**
- ✅ Privacy-first inference (no data retention)
- ✅ No user tracking or fingerprinting
- ✅ OpenAI-compatible API (drop-in replacement)
- ✅ Self-hosted option available
- ✅ Enterprise-grade privacy for financial applications

**vs. OpenAI:**
- ❌ OpenAI logs requests (even if not training)
- ❌ Fingerprinting and tracking IDs
- ❌ Potential metadata leakage
- ❌ Terms require trusting third-party with financial data

## Architecture

### New Endpoint: `/vaultChat`

**Purpose:** Specialized endpoint for KeepKey Vault chat with server-side context injection and Venice.ai privacy

**Location:** `projects/pioneer-server-v2/services/rest/src/controllers/2-intelligence.controller.ts`

**Flow:**
```
User Query → Vault UI → Pioneer Server `/vaultChat` → Venice.ai → Response
                ↓
        Server-side context injection
        - KeepKey Vault system prompt
        - Function definitions
        - Security rules
                ↓
        Venice.ai (private inference)
                ↓
        Response to Vault UI
```

## Implementation Details

### 1. Environment Configuration

**Required `.env` variable:**
```bash
VENICE_API_KEY=your-venice-api-key-here
```

**Venice.ai API Configuration:**
- Base URL: `https://api.venice.ai/api/v1` (OpenAI-compatible)
- Authentication: Bearer token
- Models: Use OpenAI-compatible model names

### 2. Venice Client Setup

```typescript
// In 2-intelligence.controller.ts

import OpenAI from 'openai';

// Existing OpenAI client (keep for other endpoints)
if(!process.env['OPENAI_API_KEY']) throw Error("Missing OPENAI_API_KEY")
const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

// NEW: Venice client for private inference
if(!process.env['VENICE_API_KEY']) throw Error("Missing VENICE_API_KEY")
const venice = new OpenAI({
    apiKey: process.env['VENICE_API_KEY'],
    baseURL: 'https://api.venice.ai/api/v1',
});
```

### 3. System Prompt (Server-Side Context Injection)

```typescript
const VAULT_SYSTEM_PROMPT = `You are a KeepKey Vault assistant. You help users manage their cryptocurrency portfolio securely.

CRITICAL SECURITY RULES:
1. NEVER reveal, display, or acknowledge private keys, seed phrases, or recovery phrases
2. NEVER execute transactions without explicit user confirmation in the UI
3. NEVER store or log sensitive information
4. If asked for private keys, respond with a security warning

Available Functions:
- navigateToAsset(caip): Open asset detail page
- navigateToSend(caip?): Open send page (optionally for specific asset)
- navigateToReceive(caip?): Open receive page with QR code
- navigateToSwap(caip?): Open swap page
- navigateToDashboard(): Return to main dashboard
- getBalances(): Get all balances with USD values
- searchAssets(query): Search assets by name or symbol
- getNetworks(): Get all configured networks
- getAddress(symbol): Get receiving address for asset
- refreshPortfolio(): Trigger portfolio data refresh

Intent Types:
- navigation: Navigate to pages (asset, send, receive, swap, dashboard)
- query_balance: Get portfolio balances and values
- query_network: Get network/blockchain information
- query_address: Get receiving addresses
- action_send: Open send page (navigate only, no execution)
- action_receive: Open receive page with address/QR
- action_swap: Open swap page
- action_refresh: Refresh portfolio data
- security_warning: Respond to sensitive/dangerous requests
- general: General questions and help

Response Format (JSON):
{
  "intent": "<intent_type>",
  "functions": ["<function_name>", ...],
  "parameters": { "<param>": "<value>", ... },
  "content": "<user_friendly_response>"
}

Examples:

User: "What's my balance?"
{
  "intent": "query_balance",
  "functions": ["getBalances"],
  "parameters": {},
  "content": "Let me check your portfolio balance..."
}

User: "Show me my Bitcoin"
{
  "intent": "navigation",
  "functions": ["searchAssets", "navigateToAsset"],
  "parameters": { "query": "bitcoin" },
  "content": "Opening your Bitcoin asset page..."
}

User: "I want to send ETH"
{
  "intent": "action_send",
  "functions": ["searchAssets", "navigateToSend"],
  "parameters": { "query": "eth" },
  "content": "Opening the send page for Ethereum..."
}

User: "What's my private key?"
{
  "intent": "security_warning",
  "functions": [],
  "parameters": {},
  "content": "I cannot and will never show private keys or seed phrases. Your private keys are stored securely on your KeepKey device and should never be shared."
}

Always respond in JSON format. Be helpful, secure, and privacy-conscious.`;
```

### 4. New `/vaultChat` Endpoint

```typescript
@Post('/vaultChat')
public async vaultChat(@Header('Authorization') authorization: string, @Body() body: any): Promise<any> {
    let tag = TAG + " | vaultChat | "
    try{
        log.info(tag,"body: ",body)

        // User validation
        let user = await redis.hgetall(authorization)
        log.info(tag,"user: ",user)

        // Extract user messages
        let userMessages = body.messages
        if(!userMessages) throw new Error("missing messages")

        // Server-side context injection
        // Prepend system prompt to user messages
        const messages = [
            { role: 'system', content: VAULT_SYSTEM_PROMPT },
            ...userMessages
        ]

        // Venice API parameters
        const params: any = {
            messages,
            model: 'gpt-4o-mini', // Venice uses OpenAI-compatible model names
            response_format: { "type": "json_object" },
            temperature: 0.7,
            max_tokens: 500,
        }

        log.info(tag, 'Calling Venice.ai with params:', {
            messageCount: messages.length,
            model: params.model,
        })

        // Call Venice.ai (OpenAI-compatible API)
        let chatCompletion = await venice.chat.completions.create(params);

        log.info(tag, 'Venice response received:', {
            id: chatCompletion.id,
            model: chatCompletion.model,
            usage: chatCompletion.usage,
        })

        // Return Venice response (same format as OpenAI)
        return chatCompletion

    } catch(e) {
        let errorResp: Error = {
            success: false,
            tag,
            e
        }
        log.error(tag, "e: ", { errorResp })
        throw new ApiError("error", 503, "error: " + e.toString());
    }
}
```

## Client-Side Changes

### Update Pioneer SDK Usage

**Before (OpenAI via /chat):**
```typescript
const response = await app.pioneer.ChatCompletion({
  model: 'gpt-4o-mini-2024-07-18',
  messages: [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    { role: 'user', content: input }
  ],
  response_format: { type: 'json_object' }
});
```

**After (Venice via /vaultChat):**
```typescript
// System prompt is now server-side, just send user message
const response = await app.pioneer.VaultChat({
  messages: [
    { role: 'user', content: input }
  ]
});

// Response structure remains the same
const intentResult = JSON.parse(response.data.choices[0].message.content);
```

### Update ChatPopup.tsx

**Changes:**
1. Remove client-side `CHAT_SYSTEM_PROMPT` import (now server-side)
2. Change API method from `ChatCompletion` to `VaultChat`
3. Simplify messages (no need to inject system prompt)
4. Update response parsing to handle `response.data.choices`

## Testing Changes

### Update Test Files

**Files to Update:**
- `tests/chat/setup-pioneer.ts` - Check for `VaultChat` method
- `tests/chat/test-inference-basic.ts` - Use `VaultChat` instead of `ChatCompletion`
- `tests/chat/test-chat-functions.ts` - Use `VaultChat` with simplified messages
- `tests/chat/test-single-debug.ts` - Debug new endpoint

**Key Changes:**
```typescript
// OLD
const response = await app.pioneer.ChatCompletion({
  model: 'gpt-4o-mini-2024-07-18',
  messages: [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    { role: 'user', content: "What's my balance?" }
  ],
  response_format: { type: 'json_object' }
});

// NEW
const response = await app.pioneer.VaultChat({
  messages: [
    { role: 'user', content: "What's my balance?" }
  ]
});

// Response parsing (add .data wrapper)
const content = response.data.choices[0].message.content;
const intentResult = JSON.parse(content);
```

## Swagger/OpenAPI Updates

**Add to swagger spec:**
```yaml
/interface/vault/chat:
  post:
    summary: KeepKey Vault Chat (Privacy-Preserving)
    description: Venice.ai-powered chat for vault with server-side context injection
    tags:
      - Intelligence
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              messages:
                type: array
                items:
                  type: object
                  properties:
                    role:
                      type: string
                      enum: [user, assistant]
                    content:
                      type: string
    responses:
      200:
        description: Chat completion response
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: string
                choices:
                  type: array
                  items:
                    type: object
```

## Migration Checklist

### Server-Side (pioneer-server-v2)
- [ ] Add `VENICE_API_KEY` to `.env`
- [ ] Create Venice OpenAI client in controller
- [ ] Add `VAULT_SYSTEM_PROMPT` constant
- [ ] Implement `/vaultChat` endpoint
- [ ] Update swagger spec
- [ ] Rebuild and deploy server

### Client-Side (keepkey-vault)
- [ ] Remove `CHAT_SYSTEM_PROMPT` from executor.ts (move to server)
- [ ] Update ChatPopup.tsx to use `VaultChat` method
- [ ] Fix response parsing (`response.data.choices`)
- [ ] Update all test files
- [ ] Test with real Venice API

### Testing
- [ ] Test basic inference with Venice
- [ ] Test all 8 function execution scenarios
- [ ] Verify no privacy leakage (check logs)
- [ ] Test error handling (API down, rate limits)
- [ ] Performance testing (response times)

## Benefits Summary

**Privacy:**
- ✅ No OpenAI tracking IDs or fingerprints
- ✅ No request logging or data retention
- ✅ Financial data stays private

**Security:**
- ✅ Server-side system prompt (can't be bypassed)
- ✅ Server-side security rules enforcement
- ✅ Controlled context injection

**Architecture:**
- ✅ Cleaner client code (no system prompt management)
- ✅ Easier to update prompts (server-side only)
- ✅ Better separation of concerns

**User Experience:**
- ✅ Same functionality, better privacy
- ✅ No noticeable performance difference
- ✅ Transparent to end users

## Next Steps

1. Implement `/vaultChat` endpoint in pioneer-server
2. Test endpoint with curl/Postman
3. Update Pioneer SDK swagger client (regenerate)
4. Update vault client code
5. Update all tests
6. Deploy and validate
