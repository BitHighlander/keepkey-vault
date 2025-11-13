# XRP Destination Tag Validation - Manual Test Plan

**Date**: 2025-11-13  
**Version**: Vault using pioneer-sdk@8.15.3  
**Status**: ⏳ Ready for Testing

---

## 🎯 Test Objective

Verify that the XRP destination tag validation prevents the critical bug where entering "test" resulted in DT: 0 on-chain.

---

## 🚀 Setup

1. ✅ Vault started at http://localhost:3000
2. ✅ Pioneer SDK updated to 8.15.3 with validation
3. ✅ UI validation added to Send.tsx

---

## 📋 Test Scenarios

### Test 1: The Original Bug - Invalid Text Input
**Priority:** 🔴 CRITICAL

**Steps:**
1. Navigate to XRP asset in Vault
2. Click "Send" button
3. Enter recipient address: `rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1` (test address)
4. Enter amount: `1`
5. In "Destination Tag (Optional)" field, type: `test`

**Expected Results:**
- ✅ Input border turns red
- ✅ Error message appears: "Destination tag must be a number (0-4294967295)"
- ✅ Cannot proceed to build transaction
- ✅ "Send" button should be disabled or show error on click

**BEFORE FIX:** Would show DT: 0 on-chain ❌  
**AFTER FIX:** Transaction blocked, error shown ✅

---

### Test 2: Valid Numeric Destination Tag
**Priority:** 🟢 HIGH

**Steps:**
1. Navigate to XRP asset in Vault
2. Click "Send" button
3. Enter recipient address: `rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1`
4. Enter amount: `1`
5. In "Destination Tag (Optional)" field, type: `12345`

**Expected Results:**
- ✅ No error shown
- ✅ Input border is normal (not red)
- ✅ Warning text shown: "⚠️ Destination tags must be numbers only..."
- ✅ Can build transaction
- ✅ Transaction preview should show: DT: 12345

---

### Test 3: Large Number (Out of Range)
**Priority:** 🟡 MEDIUM

**Steps:**
1. Navigate to XRP asset in Vault
2. Click "Send" button
3. Enter recipient address: `rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1`
4. Enter amount: `1`
5. In "Destination Tag (Optional)" field, type: `99999999999`

**Expected Results:**
- ✅ Input border turns red
- ✅ Error message: "Destination tag must be between 0 and 4294967295"
- ✅ Cannot proceed to build transaction

---

### Test 4: Negative Number
**Priority:** 🟡 MEDIUM

**Steps:**
1. Navigate to XRP asset in Vault
2. Click "Send" button
3. Enter recipient address: `rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1`
4. Enter amount: `1`
5. In "Destination Tag (Optional)" field, type: `-5`

**Expected Results:**
- ✅ Input border turns red
- ✅ Error message: "Destination tag must be a number (0-4294967295)"
- ✅ Cannot proceed to build transaction

---

### Test 5: Empty Destination Tag (Optional)
**Priority:** 🟢 HIGH

**Steps:**
1. Navigate to XRP asset in Vault
2. Click "Send" button
3. Enter recipient address: `rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1`
4. Enter amount: `1`
5. Leave "Destination Tag (Optional)" field EMPTY

**Expected Results:**
- ✅ No error shown
- ✅ Warning text shown: "⚠️ Destination tags must be numbers only..."
- ✅ Can build transaction
- ✅ Transaction preview should NOT include destination tag
- ✅ Transaction should be sent without destination tag

---

### Test 6: Edge Case - Zero
**Priority:** 🟡 MEDIUM

**Steps:**
1. Navigate to XRP asset in Vault
2. Click "Send" button
3. Enter recipient address: `rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1`
4. Enter amount: `1`
5. In "Destination Tag (Optional)" field, type: `0`

**Expected Results:**
- ✅ No error shown
- ✅ Can build transaction
- ✅ Transaction preview should show: DT: 0

---

### Test 7: Edge Case - Maximum Valid (uint32 max)
**Priority:** 🟡 MEDIUM

**Steps:**
1. Navigate to XRP asset in Vault
2. Click "Send" button
3. Enter recipient address: `rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1`
4. Enter amount: `1`
5. In "Destination Tag (Optional)" field, type: `4294967295`

**Expected Results:**
- ✅ No error shown
- ✅ Can build transaction
- ✅ Transaction preview should show: DT: 4294967295

---

### Test 8: Whitespace Handling
**Priority:** 🟡 LOW

**Steps:**
1. Navigate to XRP asset in Vault
2. Click "Send" button
3. Enter recipient address: `rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1`
4. Enter amount: `1`
5. In "Destination Tag (Optional)" field, type: `   ` (only spaces)

**Expected Results:**
- ✅ Treated as empty
- ✅ No error shown
- ✅ Can build transaction
- ✅ Transaction should be sent without destination tag

---

### Test 9: Leading/Trailing Spaces
**Priority:** 🟡 LOW

**Steps:**
1. Navigate to XRP asset in Vault
2. Click "Send" button
3. Enter recipient address: `rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1`
4. Enter amount: `1`
5. In "Destination Tag (Optional)" field, type: `  12345  ` (spaces before and after)

**Expected Results:**
- ✅ Trimmed to `12345`
- ✅ No error shown
- ✅ Can build transaction
- ✅ Transaction preview should show: DT: 12345

---

## 🔍 Visual Checks

### UI Elements to Verify:

1. **Input Field Appearance:**
   - Normal state: Gray border
   - Error state: Red border
   - Hover state: Border color changes appropriately

2. **Error Message:**
   - Red text color
   - ⚠️ warning icon
   - Clear, specific message
   - Appears immediately on invalid input

3. **Warning Message (when no error):**
   - Orange text color
   - ⚠️ warning icon
   - Shows importance of correct destination tag
   - Mentions potential loss of funds

4. **Label:**
   - Should say "Destination Tag (Optional)"
   - Not "Tag" or "Memo"

---

## 🧪 SDK Validation Test (Bypass UI)

If you can access browser console, test SDK validation:

```javascript
// Should throw error
try {
  await buildTransaction({ memo: 'test' })
} catch (error) {
  console.log('✅ SDK validation working:', error.message)
  // Expected: "XRP destination tag must be numeric. Got: "test""
}
```

---

## ✅ Success Criteria

All tests must pass:
- [ ] Test 1: Invalid text blocked ✅ CRITICAL
- [ ] Test 2: Valid number works ✅
- [ ] Test 3: Large number blocked ✅
- [ ] Test 4: Negative number blocked ✅
- [ ] Test 5: Empty works (no tag) ✅
- [ ] Test 6: Zero works ✅
- [ ] Test 7: Max value works ✅
- [ ] Test 8: Whitespace handled ✅
- [ ] Test 9: Trim spaces works ✅

---

## 🐛 If Issues Found

1. Note which test failed
2. Screenshot the error
3. Check browser console for errors
4. Document expected vs actual behavior
5. Report back to dev team

---

## 📝 Test Notes

**Tester:** _______________  
**Date:** _______________  
**Time:** _______________  
**Browser:** _______________  
**Vault URL:** http://localhost:3000  

**Test Results:**
- Test 1: ⬜ Pass / ⬜ Fail - Notes: _______________
- Test 2: ⬜ Pass / ⬜ Fail - Notes: _______________
- Test 3: ⬜ Pass / ⬜ Fail - Notes: _______________
- Test 4: ⬜ Pass / ⬜ Fail - Notes: _______________
- Test 5: ⬜ Pass / ⬜ Fail - Notes: _______________
- Test 6: ⬜ Pass / ⬜ Fail - Notes: _______________
- Test 7: ⬜ Pass / ⬜ Fail - Notes: _______________
- Test 8: ⬜ Pass / ⬜ Fail - Notes: _______________
- Test 9: ⬜ Pass / ⬜ Fail - Notes: _______________

**Overall Status:** ⬜ All Pass / ⬜ Some Failures  
**Production Ready:** ⬜ Yes / ⬜ No

---

## 🚀 After Testing

If all tests pass:
1. ✅ Mark as production ready
2. ✅ Deploy to production
3. ✅ Monitor for issues
4. ✅ Update documentation

If any test fails:
1. Document failure
2. Fix issue
3. Re-test
4. Re-deploy

