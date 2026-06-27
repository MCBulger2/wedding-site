import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';

export interface InviteCodeProtector {
  encryptInviteCode(inviteCode: string): Promise<string>;
  decryptInviteCode(ciphertext: string): Promise<string>;
}

export class AwsKmsInviteCodeProtector implements InviteCodeProtector {
  constructor(
    private readonly keyId: string,
    private readonly kmsClient = new KMSClient({}),
  ) {}

  async encryptInviteCode(inviteCode: string): Promise<string> {
    const result = await this.kmsClient.send(
      new EncryptCommand({
        KeyId: this.keyId,
        Plaintext: Buffer.from(inviteCode, 'utf8'),
      }),
    );

    if (!result.CiphertextBlob) {
      throw new Error('KMS did not return encrypted invite code data');
    }

    return Buffer.from(result.CiphertextBlob).toString('base64');
  }

  async decryptInviteCode(ciphertext: string): Promise<string> {
    const result = await this.kmsClient.send(
      new DecryptCommand({
        CiphertextBlob: Buffer.from(ciphertext, 'base64'),
        KeyId: this.keyId,
      }),
    );

    if (!result.Plaintext) {
      throw new Error('KMS did not return decrypted invite code data');
    }

    return Buffer.from(result.Plaintext).toString('utf8');
  }
}

export class Base64InviteCodeProtector implements InviteCodeProtector {
  async encryptInviteCode(inviteCode: string): Promise<string> {
    return Buffer.from(inviteCode, 'utf8').toString('base64');
  }

  async decryptInviteCode(ciphertext: string): Promise<string> {
    return Buffer.from(ciphertext, 'base64').toString('utf8');
  }
}

export function createInviteCodeProtectorFromEnvironment(): InviteCodeProtector | undefined {
  const keyId = process.env.INVITE_CODE_KMS_KEY_ID?.trim();
  return keyId ? new AwsKmsInviteCodeProtector(keyId) : undefined;
}
