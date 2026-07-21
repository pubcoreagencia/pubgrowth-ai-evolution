export interface CreatePixChargeInput {
  txid: string;
  amount: number;
  payerName?: string;
  payerDoc?: string;
  description?: string;
  expiresIn?: number; // seconds
}

export interface PixCharge {
  txid: string;
  externalId: string;
  qrcodeBase64: string;
  copyPaste: string;
  expiresAt: string; // ISO
}

export interface PaymentProvider {
  createPixCharge(input: CreatePixChargeInput): Promise<PixCharge>;
}