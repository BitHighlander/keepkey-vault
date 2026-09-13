/** Relay bridgeDeposit commits an ETH deposit, depositor and opaque orderId.
 * The destination swap terms live off-chain and cannot be inferred from the
 * calldata or from an authenticated argument schema. */
export function isRelayBridgeDeposit(to?: string, data?: string, chainId?: number): boolean {
  return chainId === 1 && to?.toLowerCase() === '0x4cd00e387622c35bddb9b4c962c136462338bc31'
    && /^0x49290c1c[0-9a-fA-F]{128}$/.test(data ?? '')
}
