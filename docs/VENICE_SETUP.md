# Venice.ai Setup Guide

## Required Environment Variables

Add these to your pioneer server `.env` file:

```bash
# Venice.ai Configuration
INFERENCE_PROVIDER=venice
VENICE_API_KEY=your-venice-api-key-here

# Alternative: you can also use INFERENCE_API_KEY
# INFERENCE_API_KEY=your-venice-api-key-here
```

## Endpoints

After rebuilding the server, these endpoints will be available:

### 1. Support Chat (with server-side system prompt)
```bash
POST /api/v1/interface/support/chat
```

Request body:
```json
{
  "messages": [
    {"role": "user", "content": "What's my balance?"}
  ],
  "model": "qwen3-4b"  // Optional, defaults to qwen3-4b
}
```

### 2. Get Recommended Models
```bash
GET /api/v1/interface/support/models
```

Returns curated list of Venice.ai models optimized for KeepKey Vault.

### 3. Get All Venice.ai Models (Live)
```bash
GET /api/v1/interface/support/models/all
```

Fetches complete list directly from Venice.ai API (future-proof).

## Available Models

**Fast & Affordable:**
- `qwen3-4b` - Venice Small (default)
- `llama-3.2-3b` - Fastest for simple tasks

**Balanced:**
- `llama-3.3-70b` - High performance
- `mistral-31-24b` - Vision-capable

**Premium:**
- `qwen3-235b` - Venice Large (most powerful)

## Testing

After rebuilding the server:

```bash
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault

# Run debug test
npx ts-node --project tsconfig.test.json tests/chat/test-single-debug.ts

# Run full test suite
pnpm run test:chat:functions
```

## Privacy Benefits

✅ No tracking IDs or fingerprints
✅ No data retention or logging
✅ Server-side system prompt (client cannot tamper)
✅ Private inference with Venice.ai
