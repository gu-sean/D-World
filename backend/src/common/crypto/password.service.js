import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

@Injectable()
export class PasswordService {
  hash(password) {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash, password) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * 계정이 없을 때도 해시 비교 시간을 소모해 존재 여부가 응답 시간으로 드러나지 않게 함
   * hash가 null이면 더미 해시와 비교하고 항상 false
   */
  async verifyOrDummy(hash, password) {
    if (hash) return this.verify(hash, password);
    this.dummyHash ??= await this.hash('dummy-password-for-timing');
    await this.verify(this.dummyHash, password);
    return false;
  }
}
