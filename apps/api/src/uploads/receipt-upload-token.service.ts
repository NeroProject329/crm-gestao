import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import {
  parseR2Env,
} from '@crm/config';

import {
  ALLOWED_RECEIPT_MIME_TYPES,
} from './upload.constants';

import type {
  ReceiptMimeType,
} from './upload.constants';

export interface ReceiptUploadTokenPayload {
  version: 1;

  companyId: string;
  employeeId: string;

  objectKey: string;

  mimeType: ReceiptMimeType;
  sizeBytes: number;

  expiresAt: number;
}

interface CreateUploadTokenInput {
  companyId: string;
  employeeId: string;

  objectKey: string;

  mimeType: ReceiptMimeType;
  sizeBytes: number;
}

@Injectable()
export class ReceiptUploadTokenService {
  create(
    input: CreateUploadTokenInput,
  ): string {
    const env =
      parseR2Env(process.env);

    const payload:
      ReceiptUploadTokenPayload = {
      version: 1,

      companyId:
        input.companyId,

      employeeId:
        input.employeeId,

      objectKey:
        input.objectKey,

      mimeType:
        input.mimeType,

      sizeBytes:
        input.sizeBytes,

      expiresAt:
        Math.floor(
          Date.now() / 1000,
        ) +
        env.R2_UPLOAD_URL_TTL_SECONDS,
    };

    const encoded =
      Buffer
        .from(
          JSON.stringify(payload),
          'utf8',
        )
        .toString('base64url');

    const signature =
      this.sign(encoded);

    return `${encoded}.${signature}`;
  }

  verify(
    token: string,
  ): ReceiptUploadTokenPayload {
    const [
      encoded,
      signature,
    ] = token.split('.');

    if (
      !encoded ||
      !signature
    ) {
      throw this.invalidToken();
    }

    const expected =
      this.sign(encoded);

    const receivedBuffer =
      Buffer.from(
        signature,
        'base64url',
      );

    const expectedBuffer =
      Buffer.from(
        expected,
        'base64url',
      );

    if (
      receivedBuffer.length !==
        expectedBuffer.length ||
      !timingSafeEqual(
        receivedBuffer,
        expectedBuffer,
      )
    ) {
      throw this.invalidToken();
    }

    let payload:
      ReceiptUploadTokenPayload;

    try {
      payload =
        JSON.parse(
          Buffer
            .from(
              encoded,
              'base64url',
            )
            .toString('utf8'),
        ) as ReceiptUploadTokenPayload;
    } catch {
      throw this.invalidToken();
    }

    if (
      payload.version !== 1 ||

      typeof payload.companyId !==
        'string' ||

      typeof payload.employeeId !==
        'string' ||

      typeof payload.objectKey !==
        'string' ||

      typeof payload.sizeBytes !==
        'number' ||

      !Number.isInteger(
        payload.sizeBytes,
      ) ||

      typeof payload.expiresAt !==
        'number' ||

      !ALLOWED_RECEIPT_MIME_TYPES
        .includes(
          payload.mimeType,
        )
    ) {
      throw this.invalidToken();
    }

    if (
      payload.expiresAt <=
      Math.floor(
        Date.now() / 1000,
      )
    ) {
      throw new BadRequestException(
        'Upload token expired.',
      );
    }

    const expectedPrefix =
      `receipts/${payload.companyId}/${payload.employeeId}/`;

    if (
      !payload.objectKey
        .startsWith(
          expectedPrefix,
        )
    ) {
      throw this.invalidToken();
    }

    return payload;
  }

  private sign(
    value: string,
  ): string {
    const env =
      parseR2Env(process.env);

    return createHmac(
      'sha256',
      env.R2_UPLOAD_TOKEN_SECRET,
    )
      .update(value)
      .digest('base64url');
  }

  private invalidToken():
    BadRequestException {
    return new BadRequestException(
      'Invalid upload token.',
    );
  }
}