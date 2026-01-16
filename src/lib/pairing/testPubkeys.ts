/**
 * Test Pubkeys for App Store Submission Testing
 *
 * IMPORTANT: These are PUBLIC test pubkeys ONLY for app store review testing.
 * - These contain NO private keys or sensitive data
 * - They are safe to commit to version control
 * - They allow app store reviewers to test the mobile app without a physical KeepKey device
 *
 * Source: projects/pioneer/e2e/wallets/intergration-view-only/pubkeys.json
 * Wallet: "TestKeepKeyMain" - Reference test wallet with known balances
 *
 * Code to access: "TESTTEST" (permanent, never expires)
 */

export const TEST_PUBKEYS_DATA = {
  pubkeys: [
    {
      type: "address",
      master: "0x141D9959cAe3853b035000490C03991eB70Fc4aC",
      address: "0x141D9959cAe3853b035000490C03991eB70Fc4aC",
      pubkey: "0x141D9959cAe3853b035000490C03991eB70Fc4aC",
      path: "m/44'/60'/0'",
      pathMaster: "m/44'/60'/0'/0/0",
      note: "ETH primary (default)",
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["eip155:1", "eip155:*"],
      addressNList: [2147483692, 2147483708, 2147483648],
      addressNListMaster: [2147483692, 2147483708, 2147483648, 0, 0]
    },
    {
      type: "xpub",
      master: "1JNYtQsc1pizKbn3ScbEPfQ7WcxNqeUHNB",
      address: "1JNYtQsc1pizKbn3ScbEPfQ7WcxNqeUHNB",
      pubkey: "xpub6BxKtd6aAuz23XqtWXeSqxShJZn8yqiUmaTdvsPWS3riKkNRcXEPmn1CXmKM1M43mrWfN5QwjdLRghZLrgwMLCeRZqZNuYhVNXr6Pp7aDsH",
      path: "m/44'/0'/0'",
      pathMaster: "m/44'/0'/0'/0/0",
      scriptType: "p2pkh",
      note: "Bitcoin account 0",
      available_scripts_types: ["p2pkh", "p2sh", "p2wpkh", "p2sh-p2wpkh"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["bip122:000000000019d6689c085ae165831e93"],
      addressNList: [2147483692, 2147483648, 2147483648],
      addressNListMaster: [2147483692, 2147483648, 2147483648, 0, 0]
    },
    {
      type: "ypub",
      master: "3M9rBdu7rkVGwmt9gALjuRopAqpVEBdNRR",
      address: "3M9rBdu7rkVGwmt9gALjuRopAqpVEBdNRR",
      pubkey: "ypub6WamSeXgTYgy7W25fVorMLDHFx5SPkuYaE7ToWCiyCUK2jdWpufQ8VqkDg83YjBtJFHDoekhf9ESdPDbL9aCPXC5NnmzXUiq3J6oycFShfS",
      path: "m/49'/0'/0'",
      pathMaster: "m/49'/0'/0'/0/0",
      scriptType: "p2sh-p2wpkh",
      note: "Bitcoin account 0 Segwit (p2sh-p2wpkh) (ypub) (bip49)",
      available_scripts_types: ["p2pkh", "p2sh", "p2wpkh", "p2sh-p2wpkh"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["bip122:000000000019d6689c085ae165831e93"],
      addressNList: [2147483697, 2147483648, 2147483648],
      addressNListMaster: [2147483697, 2147483648, 2147483648, 0, 0]
    },
    {
      type: "zpub",
      master: "bc1q8w2ypqgx39gucxcypqv2m90wz9rvhmmrcnpdjs",
      address: "bc1q8w2ypqgx39gucxcypqv2m90wz9rvhmmrcnpdjs",
      pubkey: "zpub6rm1EEJg4JasiTqacdouiUVncAc5ymhKReiPZfLTGnH2GSZquRn9reJhj6sfs73PoSJNXzpERKPVLYbwwUGHNF6jkMX5R58vWaLB9FVyJuX",
      path: "m/84'/0'/0'",
      pathMaster: "m/84'/0'/0'/0/0",
      scriptType: "p2wpkh",
      note: "Bitcoin account 0 Native Segwit (Bech32)",
      available_scripts_types: ["p2pkh", "p2sh", "p2wpkh", "p2sh-p2wpkh"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["bip122:000000000019d6689c085ae165831e93"],
      addressNList: [2147483732, 2147483648, 2147483648],
      addressNListMaster: [2147483732, 2147483648, 2147483648, 0, 0]
    },
    {
      type: "xpub",
      master: "LeELKgiF1VLuMfZ5UnAnXBStD2RagrB7Eb",
      address: "LeELKgiF1VLuMfZ5UnAnXBStD2RagrB7Eb",
      pubkey: "xpub6CQaRj3ynJXpPXzx6tbRFXLqcUuVanKWkFusZ9P7cDYAAgMmdC89rq6aofxyp1fXvscxZF5HgWgZgD3VA6sYnJPKqWnCfUxCoD1YX9TpBkx",
      path: "m/44'/2'/0'",
      pathMaster: "m/44'/2'/0'/0/0",
      scriptType: "p2pkh",
      note: "Litecoin Default path",
      available_scripts_types: ["p2pkh"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["bip122:12a765e31ffd4059bada1e25190f6e98"],
      addressNList: [2147483692, 2147483650, 2147483648],
      addressNListMaster: [2147483692, 2147483650, 2147483648, 0, 0]
    },
    {
      type: "zpub",
      master: "ltc1qqe845efrljxq2hu8hx09danuhas3lal6u38qle",
      address: "ltc1qqe845efrljxq2hu8hx09danuhas3lal6u38qle",
      pubkey: "zpub6rQAwkqDw32JoeWfaE4Evmx1ZKWWyEscT1H7RNc5eJnndNEemaiRsvGHztrVVdowubaNEGNZ3x4LFpWyZUtkP6GmfVFX4hwHPXYFfeB68Pj",
      path: "m/84'/2'/0'",
      pathMaster: "m/84'/2'/0'/0/0",
      scriptType: "p2wpkh",
      note: "Litecoin account Native Segwit (Bech32)",
      available_scripts_types: ["p2pkh", "p2sh", "p2wpkh", "p2sh-p2wpkh"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["bip122:12a765e31ffd4059bada1e25190f6e98"],
      addressNList: [2147483732, 2147483650, 2147483648],
      addressNListMaster: [2147483732, 2147483650, 2147483648, 0, 0]
    },
    {
      type: "xpub",
      master: "DHxdwdZDchQMGP5B5HVmS1gEXEoKHQTS54",
      address: "DHxdwdZDchQMGP5B5HVmS1gEXEoKHQTS54",
      pubkey: "xpub6C2KZdjcbhfMzxsXRRUuVgr4ywWpjxnU2jF2pmBr9MizYWHE5Fx6PWA9gVaTv8Rq9KznkYKQ5X2agVe2qyNttro9T6VofuSYKXWCJi6BTLs",
      path: "m/44'/3'/0'",
      pathMaster: "m/44'/3'/0'/0/0",
      scriptType: "p2pkh",
      note: "Dogecoin Default path",
      available_scripts_types: ["p2pkh"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["bip122:00000000001a91e3dace36e2be3bf030"],
      addressNList: [2147483692, 2147483651, 2147483648],
      addressNListMaster: [2147483692, 2147483651, 2147483648, 0, 0]
    },
    {
      type: "xpub",
      master: "qzfzukmpry8y4mdp6xz7cy65eagtwhajzvj749257p",
      address: "qzfzukmpry8y4mdp6xz7cy65eagtwhajzvj749257p",
      pubkey: "xpub6DPARGivQ6adLmcPV1Lg71tgmz8i3fwwy36hguPDFQyoTb2gvg1VkXpL9D2ero7ErGexbRfQ64PPufsS4oUCFrr4tEyobWmxkiyvB9MzEiL",
      path: "m/44'/145'/0'",
      pathMaster: "m/44'/145'/0'/0/0",
      scriptType: "p2pkh",
      note: "Bitcoin Cash Default path",
      available_scripts_types: ["p2pkh"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["bip122:000000000000000000651ef99cb9fcbe"],
      addressNList: [2147483692, 2147483793, 2147483648],
      addressNListMaster: [2147483692, 2147483793, 2147483648, 0, 0]
    },
    {
      type: "xpub",
      master: "Xursn5XQzLEa2J91uEWeAVsKpLsBTf393x",
      address: "Xursn5XQzLEa2J91uEWeAVsKpLsBTf393x",
      pubkey: "xpub6C32ZcmFoazJmhH5fojYAwHEggwzqo78UfbUXJjUHzxAp3k3373Yn6K56fVKkoTFehxgED6nxqeUvKX5vr8iQ3QMLcuv2pFHjJkFJ9yZMRe",
      path: "m/44'/5'/0'",
      pathMaster: "m/44'/5'/0'/0/0",
      scriptType: "p2pkh",
      note: "Default dash path",
      available_scripts_types: ["p2pkh"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["bip122:000007d91d1254d60e2dd1ae58038307"],
      addressNList: [2147483692, 2147483653, 2147483648],
      addressNListMaster: [2147483692, 2147483653, 2147483648, 0, 0]
    },
    {
      type: "address",
      master: "cosmos1rs7fckgznkaxs4sq02pexwjgar43p5wn7akqnc",
      address: "cosmos1rs7fckgznkaxs4sq02pexwjgar43p5wn7akqnc",
      pubkey: "cosmos1rs7fckgznkaxs4sq02pexwjgar43p5wn7akqnc",
      path: "m/44'/118'/0'/0/0",
      pathMaster: "m/44'/118'/0'/0/0",
      scriptType: "cosmos",
      note: "Default ATOM path",
      available_scripts_types: ["cosmos"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["cosmos:cosmoshub-4"],
      addressNList: [2147483692, 2147483766, 2147483648, 0, 0],
      addressNListMaster: [2147483692, 2147483766, 2147483648, 0, 0]
    },
    {
      type: "address",
      master: "osmo1rs7fckgznkaxs4sq02pexwjgar43p5wnkx9s92",
      address: "osmo1rs7fckgznkaxs4sq02pexwjgar43p5wnkx9s92",
      pubkey: "osmo1rs7fckgznkaxs4sq02pexwjgar43p5wnkx9s92",
      path: "m/44'/118'/0'/0/0",
      pathMaster: "m/44'/118'/0'/0/0",
      scriptType: "bech32",
      note: "Default OSMO path",
      available_scripts_types: ["bech32"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["cosmos:osmosis-1"],
      addressNList: [2147483692, 2147483766, 2147483648, 0, 0],
      addressNListMaster: [2147483692, 2147483766, 2147483648, 0, 0]
    },
    {
      type: "address",
      master: "rLRYvj3RXU16THYgwhWR3ZN639XAE68RLB",
      address: "rLRYvj3RXU16THYgwhWR3ZN639XAE68RLB",
      pubkey: "rLRYvj3RXU16THYgwhWR3ZN639XAE68RLB",
      path: "m/44'/144'/0'",
      pathMaster: "m/44'/144'/0'/0/0",
      scriptType: "p2pkh",
      note: "Default ripple path",
      available_scripts_types: ["p2pkh"],
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["ripple:4109c6f2045fc7eff4cde8f9905d19c2"],
      addressNList: [2147483692, 2147483792, 2147483648],
      addressNListMaster: [2147483692, 2147483792, 2147483648, 0, 0]
    },
    {
      type: "address",
      master: "maya1g9el7lzjwh9yun2c4jjzhy09j98vkhfxfqkl5k",
      address: "maya1g9el7lzjwh9yun2c4jjzhy09j98vkhfxfqkl5k",
      pubkey: "maya1g9el7lzjwh9yun2c4jjzhy09j98vkhfxfqkl5k",
      path: "m/44'/931'/0'/0/0",
      pathMaster: "m/44'/931'/0'/0/0",
      scriptType: "mayachain",
      note: "Default CACAO path",
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["cosmos:mayachain-mainnet-v1"],
      addressNList: [2147483692, 2147484579, 2147483648, 0, 0],
      addressNListMaster: [2147483692, 2147484579, 2147483648, 0, 0]
    },
    {
      type: "address",
      master: "thor1g9el7lzjwh9yun2c4jjzhy09j98vkhfxfhgnzx",
      address: "thor1g9el7lzjwh9yun2c4jjzhy09j98vkhfxfhgnzx",
      pubkey: "thor1g9el7lzjwh9yun2c4jjzhy09j98vkhfxfhgnzx",
      path: "m/44'/931'/0'/0/0",
      pathMaster: "m/44'/931'/0'/0/0",
      scriptType: "thorchain",
      note: "Default RUNE path",
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["cosmos:thorchain-mainnet-v1"],
      addressNList: [2147483692, 2147484579, 2147483648, 0, 0],
      addressNListMaster: [2147483692, 2147484579, 2147483648, 0, 0]
    },
    {
      type: "address",
      master: "53d22cSwJjdRdRMG1NKLH7RU3Khm9Ap4uMxYy21FeF5R",
      address: "53d22cSwJjdRdRMG1NKLH7RU3Khm9Ap4uMxYy21FeF5R",
      pubkey: "53d22cSwJjdRdRMG1NKLH7RU3Khm9Ap4uMxYy21FeF5R",
      path: "m/44'/501'/0'/0'",
      pathMaster: "m/44'/501'/0'/0'",
      scriptType: "solana",
      note: "Default Solana path",
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
      addressNList: [2147484149, 2147484149, 2147483648, 2147483648],
      addressNListMaster: [2147484149, 2147484149, 2147483648, 2147483648]
    },
    {
      type: "address",
      master: "TDuVGZrS1HukU7Aa7ySHufCvCrFbUkkt5L",
      address: "TDuVGZrS1HukU7Aa7ySHufCvCrFbUkkt5L",
      pubkey: "TDuVGZrS1HukU7Aa7ySHufCvCrFbUkkt5L",
      path: "m/44'/195'/0'/0/0",
      pathMaster: "m/44'/195'/0'/0/0",
      scriptType: "tron",
      note: "Default TRON path",
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["tron:27Lqcw"],
      addressNList: [2147483692, 2147483843, 2147483648, 0, 0],
      addressNListMaster: [2147483692, 2147483843, 2147483648, 0, 0]
    },
    {
      type: "address",
      master: "UQCOaiHxKJXJ07_P3iSNTuDI2tzgI9qi0okcWW-3tTmjQebd",
      address: "UQCOaiHxKJXJ07_P3iSNTuDI2tzgI9qi0okcWW-3tTmjQebd",
      addressBounce: "EQCOaiHxKJXJ07_P3iSNTuDI2tzgI9qi0okcWW-3tTmjQTGe",
      addressNonBounce: "UQCOaiHxKJXJ07_P3iSNTuDI2tzgI9qi0okcWW-3tTmjQebd",
      pubkey: "UQCOaiHxKJXJ07_P3iSNTuDI2tzgI9qi0okcWW-3tTmjQebd",
      path: "m/44'/607'/0'/0/0/0",
      pathMaster: "m/44'/607'/0'/0/0/0",
      scriptType: "ton",
      note: "TON address from reference seed with funds",
      context: "keepkey:TestKeepKeyMain.json",
      networks: ["ton:-239"],
      addressNList: [2147484255, 2147484255, 2147483648, 0, 0, 0],
      addressNListMaster: [2147484255, 2147484255, 2147483648, 0, 0, 0]
    }
  ],
  deviceInfo: {
    label: "KeepKey TestNet",
    model: "KeepKey",
    deviceId: "TEST-APPSTORE-DEVICE",
    features: {}
  },
  timestamp: Date.now(),
  version: "1.0.1"
};

export const TEST_CODE = "TESTTEST"; // Permanent test code for app store reviewers

export function isTestCode(code: string): boolean {
  return code === TEST_CODE;
}
