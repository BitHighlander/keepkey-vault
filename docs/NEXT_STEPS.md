# Next Steps - Venice.ai SupportChat

## Status

✅ **Code Added**: `/supportChat` endpoint added to `/projects/pioneer/services/pioneer-server/src/controllers/inference.controller.ts`

✅ **Routes Generated**: The `make` command generated the route at `/api/v1/interface/support/chat` in `routes.ts`

❌ **Server Not Serving**: The endpoint returns 404, which means the server isn't running the new code

## The Problem

The route exists in `src/routes.ts` but the server responds with:
```
Cannot POST /api/v1/interface/support/chat
```

This means either:
1. The server wasn't restarted after rebuild
2. The server is serving cached/old JavaScript
3. PM2 needs to be restarted

## Solution

You need to **fully restart** the pioneer-server. The `make start` might not kill the old process.

### Try These Commands (in order):

```bash
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer

# Option 1: If using PM2
pm2 list                    # See if pioneer-server is running
pm2 stop pioneer-server     # Stop it
pm2 delete pioneer-server   # Remove it
make && make start          # Rebuild and start fresh

# Option 2: If not using PM2
# Find and kill the process
lsof -i :9001              # Find what's using port 9001
kill -9 <PID>              # Kill it
make && make start          # Rebuild and start fresh

# Option 3: Just restart with make
make stop                   # If this command exists
make clean                  # Clean build artifacts
make && make start          # Full rebuild
```

### Verify It Worked

```bash
# 1. Check the endpoint exists in routes
grep "support/chat" /Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/services/pioneer-server/src/routes.ts

# Should show: app.post('/api/v1/interface/support/chat'

# 2. Test the endpoint
curl -X POST http://localhost:9001/api/v1/interface/support/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What is my balance?"}]}'

# Should return Venice.ai JSON response, NOT "Cannot POST"

# 3. Check swagger (might not update immediately, but endpoint should work)
curl -s http://localhost:9001/spec/swagger.json | jq '.paths | keys[]' | grep support
```

## Once Server is Restarted

Run the vault test:
```bash
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault

# Test the Venice.ai endpoint
npx ts-node --project tsconfig.test.json tests/chat/test-single-debug.ts
```

Expected output:
```
✅ Pioneer SDK initialized
  Has SupportChat API: true  # ← Should be true now

Making SupportChat API call...
✅ Response received!
✅ Venice.ai response parsed successfully!
Model: qwen3-4b
Privacy: Venice.ai (no tracking)
```

## Current File Locations

**Server Code (CORRECT)**:
- `/Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/services/pioneer-server/src/controllers/inference.controller.ts`

**Client Code**:
- `/Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault/src/components/chat/ChatPopup.tsx`
- `/Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault/src/lib/chat/executor.ts`
- `/Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault/tests/chat/test-single-debug.ts`

All client code is already updated and ready to test once the server is running the new code.
