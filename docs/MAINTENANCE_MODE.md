# KeepKey Vault - Maintenance Mode

This document describes how to enable and configure maintenance mode for the KeepKey Vault Next.js application.

## Overview

Maintenance mode displays a user-friendly maintenance page instead of the normal application interface. This is useful during:
- Planned maintenance windows
- System upgrades
- Emergency maintenance
- Backend service updates
- Database migrations

## Quick Start

### Method 1: .env.local File (Recommended for Development)

1. Create or edit `.env.local` in the project root:
   ```bash
   cd /Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault
   # Edit .env.local (already created with maintenance mode ENABLED)
   ```

2. Ensure it contains:
   ```env
   NEXT_PUBLIC_MAINTENANCE_MODE=true
   ```

3. Restart the development server:
   ```bash
   pnpm dev
   ```

**Note**: `.env.local` takes precedence over `.env` and is not committed to git.

### Method 2: .env File (For Production Deployment)

1. Edit `.env` file in the project root:
   ```env
   NEXT_PUBLIC_MAINTENANCE_MODE=true
   ```

2. Rebuild and restart:
   ```bash
   pnpm build
   pnpm start
   ```

### Method 3: Hardcoded Configuration

1. Open `src/config/maintenance.ts`

2. Set `HARDCODED_MAINTENANCE_MODE` to `true`:
   ```typescript
   const HARDCODED_MAINTENANCE_MODE = true
   ```

3. Restart the dev server or rebuild

## Configuration Options

### Environment Variables

All environment variables use the `NEXT_PUBLIC_` prefix to be accessible in the browser:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NEXT_PUBLIC_MAINTENANCE_MODE` | Enable/disable maintenance mode | `false` | `true` |
| `NEXT_PUBLIC_MAINTENANCE_MESSAGE` | Custom maintenance message | "KeepKey Vault is currently undergoing maintenance" | "Scheduled upgrade in progress" |
| `NEXT_PUBLIC_MAINTENANCE_ETA` | Estimated downtime | "TBD" | "2 hours" |

### Example Configuration

**.env.local** (development):
```env
# Enable maintenance mode
NEXT_PUBLIC_MAINTENANCE_MODE=true

# Custom message
NEXT_PUBLIC_MAINTENANCE_MESSAGE=We're upgrading to v2.0! Please check back in 2 hours.

# Estimated downtime
NEXT_PUBLIC_MAINTENANCE_ETA=2 hours
```

## How It Works

### Technical Implementation

1. **Configuration**: `src/config/maintenance.ts` exports `isMaintenanceMode()` function
2. **Page Check**: `src/app/page.tsx` checks maintenance mode on render
3. **Conditional Rendering**: If enabled, renders `MaintenancePage` component instead of normal app
4. **Environment Variables**: Uses Next.js `NEXT_PUBLIC_` prefix for client-side access

### Component Hierarchy

```
src/app/page.tsx (checks isMaintenanceMode())
  ├── MaintenancePage (if maintenance mode enabled)
  └── Dashboard (normal app flow if disabled)
```

### Priority Order

Configuration priority (highest to lowest):

1. **Environment variable** (`NEXT_PUBLIC_MAINTENANCE_MODE`) - Highest priority
2. **Hardcoded value** (`HARDCODED_MAINTENANCE_MODE` in maintenance.ts)

If both are set, the environment variable wins.

### Next.js Environment File Priority

Next.js loads environment variables in this order (highest to lowest):

1. `.env.local` - **Local overrides, not committed to git**
2. `.env.development` or `.env.production` - Environment-specific
3. `.env` - Committed defaults

## Customization

### Styling

The maintenance page uses:
- Chakra UI components
- Same background as the main app (`/images/backgrounds/splash-bg.png`)
- KeepKey logo with pulse animation
- Responsive design

To customize, edit `src/components/maintenance/MaintenancePage.tsx`

### Content

The page displays:
- KeepKey logo (animated pulse)
- "Maintenance Mode" title with tool icons
- Maintenance message (configurable via env var)
- Secondary message about improvements
- Estimated downtime (configurable via env var)
- Support link at the bottom

## Enabling/Disabling Maintenance Mode

### Enable Maintenance Mode

**Development**:
```bash
# Edit .env.local
echo "NEXT_PUBLIC_MAINTENANCE_MODE=true" >> .env.local
pnpm dev
```

**Production**:
```bash
# Set environment variable in deployment platform
# Or edit .env
NEXT_PUBLIC_MAINTENANCE_MODE=true pnpm build && pnpm start
```

### Disable Maintenance Mode

**Development**:
```bash
# Edit .env.local and set to false or remove the line
NEXT_PUBLIC_MAINTENANCE_MODE=false
# Or delete .env.local
rm .env.local
pnpm dev
```

**Production**:
```bash
# Remove or set to false
NEXT_PUBLIC_MAINTENANCE_MODE=false pnpm build && pnpm start
```

## Testing

### Local Testing

1. Enable maintenance mode in `.env.local`
2. Start dev server: `pnpm dev`
3. Visit `http://localhost:3000` (or configured PORT)
4. You should see the maintenance page
5. Disable maintenance mode and verify normal app loads

### Production Testing

1. Build with maintenance mode enabled:
   ```bash
   NEXT_PUBLIC_MAINTENANCE_MODE=true pnpm build
   ```
2. Start the production server:
   ```bash
   pnpm start
   ```
3. Verify maintenance page displays
4. Build without maintenance mode and verify normal operation

## Deployment

### Vercel/Netlify

Set environment variables in your deployment platform:

1. Go to project settings → Environment Variables
2. Add: `NEXT_PUBLIC_MAINTENANCE_MODE=true`
3. Add (optional): `NEXT_PUBLIC_MAINTENANCE_MESSAGE=Custom message`
4. Add (optional): `NEXT_PUBLIC_MAINTENANCE_ETA=2 hours`
5. Redeploy the application

### Docker/Self-Hosted

Pass environment variables during build or runtime:

```bash
# Build time
docker build --build-arg NEXT_PUBLIC_MAINTENANCE_MODE=true .

# Runtime (if using standalone mode)
docker run -e NEXT_PUBLIC_MAINTENANCE_MODE=true your-image
```

### CI/CD Pipeline

Add environment variables to your CI/CD configuration:

**GitHub Actions**:
```yaml
env:
  NEXT_PUBLIC_MAINTENANCE_MODE: true
  NEXT_PUBLIC_MAINTENANCE_MESSAGE: "Scheduled maintenance"
  NEXT_PUBLIC_MAINTENANCE_ETA: "1 hour"
```

## Troubleshooting

### Maintenance mode not activating

1. **Check environment variable name**: Must be `NEXT_PUBLIC_MAINTENANCE_MODE` (not `MAINTENANCE_MODE`)
2. **Check value**: Must be string `'true'` (not boolean)
3. **Restart required**: Changes to env vars require dev server restart or rebuild
4. **File location**: `.env.local` must be in project root, not `src/`
5. **Cache**: Clear Next.js cache: `rm -rf .next`

### Changes not reflected

1. **Restart dev server**: `pnpm dev` (stop and restart, not just refresh)
2. **Clear browser cache**: Hard refresh (Cmd+Shift+R on macOS)
3. **Rebuild**: For production, must rebuild: `pnpm build`
4. **Check file precedence**: `.env.local` overrides `.env`

### Environment variable not found

1. **Prefix required**: All client-side vars need `NEXT_PUBLIC_` prefix
2. **Server restart**: Required after adding/changing env vars
3. **Build time**: `NEXT_PUBLIC_*` vars are embedded at build time

## Security Considerations

- `.env.local` is **not committed** to git (already in `.gitignore`)
- `.env` **may be committed** but should not contain secrets
- Use `.env.example` for documentation
- API keys and secrets should be server-side only (no `NEXT_PUBLIC_` prefix)

## Files Modified

- `src/components/maintenance/MaintenancePage.tsx` - Maintenance page component
- `src/config/maintenance.ts` - Maintenance mode configuration
- `src/app/page.tsx` - Main page (checks for maintenance mode)
- `.env.local` - Local environment overrides (maintenance enabled)
- `.env.example` - Environment variable template
- `MAINTENANCE_MODE.md` - This documentation

## Support

For issues or questions:
- GitHub Issues: [KeepKey Stack Issues](https://github.com/keepkey/keepkey-stack/issues)
- Support: keepkey.com/support

## Current Status

🔴 **MAINTENANCE MODE IS CURRENTLY ENABLED**

The `.env.local` file has been created with `NEXT_PUBLIC_MAINTENANCE_MODE=true`.

To disable, either:
- Delete `.env.local`, OR
- Edit `.env.local` and set `NEXT_PUBLIC_MAINTENANCE_MODE=false`

Then restart the dev server.
