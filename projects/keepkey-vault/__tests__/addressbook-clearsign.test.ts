import { describe, expect, test } from 'bun:test'
import { buildCertificationRequest, buildContactProof, evmRecipient, type AddressBookCertification } from '../src/bun/addressbook-clearsign'

const contacts = [
  { chainId: 1, address: '0x1111111111111111111111111111111111111111', label: 'Alice' },
  { chainId: 137, address: '0x2222222222222222222222222222222222222222', label: 'Bob' },
  { chainId: 1, address: '0x3333333333333333333333333333333333333333', label: 'Carol' },
]

describe('address-book ClearSign', () => {
  test('builds deterministic bulk request and compact inclusion proof', () => {
    const built = buildCertificationRequest(contacts, 7)
    expect(built.payload.subarray(0, 8).toString()).toBe('KKABREQ1')
    expect(built.root.toString('hex')).toHaveLength(64)
    const cert: AddressBookCertification = {
      version: 1, revision: 7, contacts, root: built.root.toString('hex'),
      publicKey: `02${'44'.repeat(32)}`, signature: '55'.repeat(64), certifiedAt: 1,
    }
    const proof = buildContactProof(cert, 137, contacts[1].address)!
    expect(Buffer.from(proof, 'hex').subarray(0, 8).toString()).toBe('KKABPRF1')
    expect(buildContactProof(cert, 1, '0x9999999999999999999999999999999999999999')).toBeUndefined()
  })

  test('extracts native and canonical ERC-20 recipients', () => {
    expect(evmRecipient({ chainId: 1, to: contacts[0].address })).toEqual({ chainId: 1, address: contacts[0].address })
    const data = `0xa9059cbb${'0'.repeat(24)}${contacts[1].address.slice(2)}${'0'.repeat(63)}1`
    expect(evmRecipient({ chainId: 137, to: contacts[0].address, data })).toEqual({ chainId: 137, address: contacts[1].address })
  })

  test('rejects unsafe labels', () => {
    expect(() => buildCertificationRequest([{ ...contacts[0], label: 'Bob\nConfirm' }], 1)).toThrow()
    expect(() => buildCertificationRequest([{ ...contacts[0], label: 'Bøb' }], 1)).toThrow()
  })
})
