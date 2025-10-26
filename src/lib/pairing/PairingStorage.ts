/**
 * In-memory pairing storage with automatic expiration
 * For production, consider Redis for multi-instance deployments
 */

interface PairingData {
  deviceId: string;
  label: string;
  pubkeys: any[];
  createdAt: number;
  expiresAt: number;
  vaultUrl: string;
}

interface PairingRecord {
  code: string;
  data: PairingData;
  used: boolean;
}

class PairingStorageService {
  private pairings: Map<string, PairingRecord> = new Map();
  private readonly EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly CODE_LENGTH = 8;
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute

  constructor() {
    // Start cleanup job
    this.startCleanupJob();
  }

  /**
   * Generate a unique 8-character alphanumeric code
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (I, 1, O, 0)
    let code = '';
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create a new pairing
   */
  async createPairing(
    deviceId: string,
    label: string,
    pubkeys: any[],
    vaultUrl: string
  ): Promise<{ code: string; expiresAt: number; expiresIn: number }> {
    // Generate unique code
    let code = this.generateCode();
    let attempts = 0;
    while (this.pairings.has(code) && attempts < 10) {
      code = this.generateCode();
      attempts++;
    }

    if (this.pairings.has(code)) {
      throw new Error('Failed to generate unique pairing code');
    }

    const now = Date.now();
    const expiresAt = now + this.EXPIRATION_MS;

    const pairingData: PairingData = {
      deviceId,
      label,
      pubkeys,
      createdAt: now,
      expiresAt,
      vaultUrl,
    };

    this.pairings.set(code, {
      code,
      data: pairingData,
      used: false,
    });

    console.log(`✅ Created pairing: ${code} (expires in 15 min)`);
    console.log(`   Device: ${label}`);
    console.log(`   Pubkeys: ${pubkeys.length}`);

    return {
      code,
      expiresAt,
      expiresIn: Math.floor(this.EXPIRATION_MS / 1000),
    };
  }

  /**
   * Retrieve and consume pairing (one-time use)
   */
  async consumePairing(code: string): Promise<PairingData | null> {
    const pairing = this.pairings.get(code);

    if (!pairing) {
      console.warn(`❌ Pairing not found: ${code}`);
      return null;
    }

    // Check if already used
    if (pairing.used) {
      console.warn(`❌ Pairing already used: ${code}`);
      this.pairings.delete(code); // Clean up
      throw new Error('ALREADY_USED');
    }

    // Check if expired
    if (Date.now() > pairing.data.expiresAt) {
      console.warn(`❌ Pairing expired: ${code}`);
      this.pairings.delete(code); // Clean up
      return null;
    }

    // Mark as used and return data
    pairing.used = true;
    console.log(`✅ Pairing consumed: ${code}`);

    // Delete after returning (one-time use)
    this.pairings.delete(code);

    return pairing.data;
  }

  /**
   * Cleanup expired pairings
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [code, pairing] of this.pairings.entries()) {
      if (now > pairing.data.expiresAt) {
        this.pairings.delete(code);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired pairings`);
    }
  }

  /**
   * Start background cleanup job
   */
  private startCleanupJob(): void {
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Get stats (for debugging)
   */
  getStats(): { total: number; active: number; expired: number } {
    const now = Date.now();
    let active = 0;
    let expired = 0;

    for (const pairing of this.pairings.values()) {
      if (now > pairing.data.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.pairings.size,
      active,
      expired,
    };
  }
}

// Singleton instance
export const pairingStorage = new PairingStorageService();
