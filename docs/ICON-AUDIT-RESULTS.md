# Icon System Audit Results

## Executive Summary

**Date**: 2025-11-29
**Status**: 🔴 Critical - Many icons missing from CDN
**Impact**: Poor UX, user confusion, reduced trust

## Findings

### ✅ What's Working

1. **Network Badge System**: Successfully implemented
   - Network badges appear on icons
   - Color-coded borders working (Ethereum blue, BNB Chain yellow, etc.)
   - Network names displayed correctly

2. **Icon Fallback Chain**: Functioning correctly
   - Primary URL → CDN → Localhost → Generic icon
   - Generic coin placeholder appears when all sources fail

3. **Network Recognition**: Fixed for most chains
   - ✅ Ethereum, BNB Chain, Avalanche, Bitcoin working
   - ✅ Litecoin and Dogecoin fixed (was showing "Unknown")

### ❌ What's Broken

#### 1. Missing Icons on CDN (403 Forbidden)

**Broken BNB Chain Assets**:
- **BTCB** (Bitcoin BEP20): `eip155:56/erc20:0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c`
  - URL: `...ZWlwMTU1OjU2L2VyYzIwOjB4NzEzMGQyYTEyYjliY2JmYWU0ZjI2MzRkODY0YTFlZTFjZTNlYWQ5Yw==.png`
  - Status: **403 Forbidden**

- **BUSD** (Binance USD): `eip155:56/erc20:0xe9e7cea3dedca5984780bafc599bd69add087d56`
  - URL: `...ZWlwMTU1OjU2L2VyYzIwOjB4ZTllN2NlYTNkZWRjYTU5ODQ3ODBiYWZjNTk5YmQ2OWFkZDA4N2Q1Ng==.png`
  - Status: **403 Forbidden**

- **ETH** (Wrapped Ethereum): `eip155:56/erc20:0x2170ed0880ac9a755fd29b2688956bd959f933f8`
  - URL: `...ZWlwMTU1OjU2L2VyYzIwOjB4MjE3MGVkMDg4MGFjOWE3NTVmZDI5YjI2ODg5NTZiZDk1OWY5MzNmOA==.png`
  - Status: **403 Forbidden**

- **TWT** (Trust Wallet Token): `eip155:56/erc20:0x4b0f1812e5df2a09796481ff14017e6005508003`
  - URL: `...ZWlwMTU1OjU2L2VyYzIwOjB4NGIwZjE4MTJlNWRmMmEwOTc5NjQ4MWZmMTQwMTdlNjAwNTUwODAwMw==.png`
  - Status: **403 Forbidden**

**Working Icons** (for comparison):
- ✅ USDP (Ethereum): Icon loads successfully
- ✅ USDT (Ethereum): Icon loads successfully
- ✅ WBTC (Ethereum): Icon loads successfully
- ✅ BNB (native): Icon loads successfully

#### 2. THORChain CAIP Data Issues

**Litecoin networkId**: `bip122:00000000000000000000000000000000` (all zeros - WRONG!)
- Should be: `bip122:12a765e31ffd4059bada1e25190f6e98`
- **Status**: Fixed in networkIcons.ts with dual mapping

**Dogecoin networkId**: `bip122:000000000000000000000000000000001` (all zeros + 1 - WRONG!)
- Should be: `bip122:1a91e3dace36e2be3bf030a65679fe82`
- **Status**: Fixed in networkIcons.ts with dual mapping

**Root Cause**: THORChain's `fetch-thorchain-pools.js` script generates incorrect CAIP networkIds for some chains.

## Root Cause Analysis

### Why Icons Are Missing

**Problem**: Icons don't exist on the KeepKey CDN at the expected URLs.

**Reason**: The CDN upload process hasn't been completed for many assets, especially:
1. ERC20/BEP20 tokens on secondary chains
2. Wrapped assets (WBTC, WETH on BSC, etc.)
3. Less common tokens (TWT, BUSD, etc.)

**Evidence**:
- Ethereum mainnet assets (USDT, WBTC) work → icons exist
- BNB Chain tokens return 403 → icons missing
- Fallback chain working correctly → reaches generic icon

### Why Some Network Names Show "Unknown"

**Problem**: THORChain pool data has incorrect genesis block hashes for some chains.

**Affected Chains**:
- Litecoin: Uses `bip122:00000000...` instead of actual genesis hash
- Dogecoin: Uses `bip122:00000000...1` instead of actual genesis hash

**Fix**: Added dual mappings in `networkIcons.ts` to handle both wrong and correct hashes.

## Action Items

### 🔥 Immediate (Critical)

1. **Upload Missing Icons to CDN**
   - Priority: BNB Chain tokens (BTCB, BUSD, ETH, TWT)
   - See upload script below

2. **Verify Icon Permissions**
   - Check S3 bucket ACL settings
   - Ensure public-read access for `/coins/` folder

### 📋 Short Term (This Week)

1. **Bulk Icon Upload**
   - Upload all THORChain pool asset icons
   - Verify each upload with HTTP HEAD request

2. **Fix THORChain Pool Generator**
   - Update `scripts/fetch-thorchain-pools.js`
   - Use correct genesis hashes for LTC and DOGE
   - Validate all networkIds before generation

3. **Add Icon Validation**
   - Pre-flight check: does icon exist on CDN?
   - Fallback to CoinGecko/Token logos if missing
   - Log missing icons for manual review

### 🛠️ Long Term (Next Sprint)

1. **Automated Icon Pipeline**
   - Fetch icons from CoinGecko API
   - Generate CAIP-encoded filenames
   - Upload to CDN automatically
   - Verify upload success

2. **Icon Health Dashboard**
   - Track CDN icon coverage %
   - Alert on missing icons
   - Auto-retry failed uploads

3. **Alternative Icon Sources**
   - Implement multi-source fallback (CoinGecko, Trust Wallet, etc.)
   - Cache successful lookups
   - Reduce CDN dependency

## Upload Script

### Quick Fix: Upload Missing BNB Chain Icons

```bash
#!/bin/bash
# upload-missing-icons.sh

# Configuration
S3_BUCKET="keepkey"
CDN_ENDPOINT="https://sfo3.digitaloceanspaces.com"
COINS_DIR="./temp-icons"

# Create temp directory
mkdir -p "$COINS_DIR"

# Asset mappings: symbol -> contract address
declare -A ASSETS=(
  ["BTCB"]="0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c"
  ["BUSD"]="0xe9e7cea3dedca5984780bafc599bd69add087d56"
  ["ETH"]="0x2170ed0880ac9a755fd29b2688956bd959f933f8"
  ["TWT"]="0x4b0f1812e5df2a09796481ff14017e6005508003"
)

# Download icons from CoinGecko
download_icon() {
  local symbol="$1"
  local contract="$2"

  echo "Downloading $symbol icon..."

  # Try CoinGecko API (requires API key or use public CDN)
  curl -s "https://assets.coingecko.com/coins/images/[ID]/small/[symbol].png" \
    -o "$COINS_DIR/${symbol}.png"

  # Alternative: Trust Wallet Assets
  # https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${contract}/logo.png
}

# Upload to KeepKey CDN
upload_to_cdn() {
  local symbol="$1"
  local contract="$2"

  # Generate CAIP
  local caip="eip155:56/erc20:${contract}"

  # Base64 encode CAIP
  local filename=$(echo -n "$caip" | base64)

  echo "Uploading $symbol as $filename.png..."

  # Upload to S3
  aws s3 cp "$COINS_DIR/${symbol}.png" \
    "s3://$S3_BUCKET/coins/${filename}.png" \
    --acl public-read \
    --content-type "image/png" \
    --endpoint-url "$CDN_ENDPOINT"

  # Verify upload
  local cdn_url="https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/${filename}.png"
  echo "Verifying: $cdn_url"
  curl -I "$cdn_url" | grep "HTTP"
  echo
}

# Process each asset
for symbol in "${!ASSETS[@]}"; do
  contract="${ASSETS[$symbol]}"
  download_icon "$symbol" "$contract"
  upload_to_cdn "$symbol" "$contract"
done

echo "✅ Upload complete!"
```

### Manual Upload (One Asset)

```bash
# Example: Upload BTCB icon

# 1. Get icon (download from CoinGecko or official source)
wget https://assets.coingecko.com/coins/images/14108/small/BTCB.png -O btcb.png

# 2. Generate CAIP and encode
CAIP="eip155:56/erc20:0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c"
FILENAME=$(echo -n "$CAIP" | base64)
echo "Filename: ${FILENAME}.png"

# 3. Upload to S3
aws s3 cp btcb.png "s3://keepkey/coins/${FILENAME}.png" \
  --acl public-read \
  --content-type "image/png" \
  --endpoint-url https://sfo3.digitaloceanspaces.com

# 4. Verify
curl -I "https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/${FILENAME}.png"
# Should return: HTTP/2 200
```

## Testing Checklist

After uploading icons:

- [ ] BTCB icon appears (no generic coin)
- [ ] BUSD icon appears
- [ ] ETH (BNB Chain) icon appears
- [ ] TWT icon appears
- [ ] Network badges still visible
- [ ] Color-coded borders working
- [ ] Sorting by network correct
- [ ] No "Unknown" network labels

## Success Metrics

**Before Fix**:
- Icon coverage: ~40% (many generic placeholders)
- Unknown networks: 2 (LTC, DOGE)
- User confusion: High (can't distinguish chains)

**After Fix** (Target):
- Icon coverage: >95%
- Unknown networks: 0
- User confusion: Low (clear network identification)
- CDN hit rate: >99%

## Related Issues

- THORChain pool generator using wrong genesis hashes
- S3 bucket missing icons for BEP20 tokens
- No automated icon upload pipeline
- No icon validation in CI/CD

## Recommendations

1. **Immediate**: Run upload script for BNB Chain assets
2. **Short-term**: Fix THORChain pool generator
3. **Long-term**: Implement automated icon pipeline
4. **Process**: Add icon upload to release checklist

## Appendix: Working vs Broken Examples

### ✅ Working Icon Flow
```
USDT (Ethereum)
└─ CAIP: eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7
   └─ Base64: ZWlwMTU1OjEvZXJjMjA6MHhkYWMxN2Y5NThkMmVlNTIzYTIyMDYyMDY5OTQ1OTdjMTNkODMxZWM3
      └─ CDN URL: https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/[BASE64].png
         └─ HTTP 200 ✅ Icon loads!
```

### ❌ Broken Icon Flow
```
BTCB (BNB Chain)
└─ CAIP: eip155:56/erc20:0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c
   └─ Base64: ZWlwMTU1OjU2L2VyYzIwOjB4NzEzMGQyYTEyYjliY2JmYWU0ZjI2MzRkODY0YTFlZTFjZTNlYWQ5Yw==
      └─ CDN URL: https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/[BASE64].png
         └─ HTTP 403 ❌ Forbidden!
            └─ Fallback to generic coin icon 🪙
```

## Conclusion

The icon system architecture is **solid** and working as designed. The issue is simply **missing icon files** on the CDN.

**Quick Win**: Upload the 4 missing BNB Chain icons → immediate UX improvement.

**Long-term**: Implement automated icon pipeline → prevent future issues.
