import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type {
  HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';

import {
  getSignedUrl,
} from '@aws-sdk/s3-request-presigner';

import {
  randomUUID,
} from 'node:crypto';

import {
  parseR2Env,
} from '@crm/config';

import type {
  ReceiptFileUrlResponse,
  ReceiptUploadInitResponse,
} from '@crm/contracts';

import {
  extensionForMimeType,
} from './upload.constants';

import type {
  ReceiptMimeType,
} from './upload.constants';

import {
  ReceiptUploadTokenService,
} from './receipt-upload-token.service';

import type {
  ReceiptUploadTokenPayload,
} from './receipt-upload-token.service';

@Injectable()
export class ReceiptStorageService {
  private readonly client:
    S3Client;

  constructor(
    private readonly tokens:
      ReceiptUploadTokenService,
  ) {
    const env =
      parseR2Env(process.env);

    this.client =
      new S3Client({
        region:
          env.R2_REGION,

        endpoint:
          env.R2_ENDPOINT,

        credentials: {
          accessKeyId:
            env.R2_ACCESS_KEY_ID,

          secretAccessKey:
            env.R2_SECRET_ACCESS_KEY,
        },
      });
  }

  async createUpload(
    companyId: string,
    employeeId: string,
    mimeType: ReceiptMimeType,
    sizeBytes: number,
  ): Promise<ReceiptUploadInitResponse> {
    const env =
      parseR2Env(process.env);

    if (
      sizeBytes >
      env.R2_MAX_RECEIPT_BYTES
    ) {
      throw new BadRequestException(
        'Receipt file is too large.',
      );
    }

    const now =
      new Date();

    const year =
      now
        .getUTCFullYear()
        .toString();

    const month =
      String(
        now.getUTCMonth() + 1,
      ).padStart(2, '0');

    const extension =
      extensionForMimeType(
        mimeType,
      );

    const objectKey =
      `receipts/${companyId}/${employeeId}/${year}/${month}/${randomUUID()}.${extension}`;

    const command =
      new PutObjectCommand({
        Bucket:
          env.R2_BUCKET_NAME,

        Key:
          objectKey,

        ContentType:
          mimeType,
      });

    const uploadUrl =
      await getSignedUrl(
        this.client,
        command,
        {
          expiresIn:
            env.R2_UPLOAD_URL_TTL_SECONDS,
        },
      );

    const uploadToken =
      this.tokens.create({
        companyId,
        employeeId,

        objectKey,

        mimeType,
        sizeBytes,
      });

    return {
      uploadUrl,
      uploadToken,

      method:
        'PUT',

      headers: {
        'Content-Type':
          mimeType,
      },

      expiresInSeconds:
        env.R2_UPLOAD_URL_TTL_SECONDS,
    };
  }

  async validateCompletedUpload(
    uploadToken: string,
  ): Promise<ReceiptUploadTokenPayload> {
    const payload =
      this.tokens.verify(
        uploadToken,
      );

    const env =
      parseR2Env(process.env);

    let head: HeadObjectCommandOutput;

try {
  head =
    await this.client.send(
      new HeadObjectCommand({
        Bucket:
          env.R2_BUCKET_NAME,

        Key:
          payload.objectKey,
      }),
    );
} catch {
  throw new BadRequestException(
    'Uploaded file was not found.',
  );
}

    if (
      head.ContentLength !==
      payload.sizeBytes
    ) {
      throw new BadRequestException(
        'Uploaded file size does not match the upload request.',
      );
    }

    const contentType =
      head.ContentType
        ?.split(';')[0]
        ?.trim()
        .toLowerCase();

    if (
      contentType !==
      payload.mimeType
    ) {
      throw new BadRequestException(
        'Uploaded file type does not match the upload request.',
      );
    }

    await this.validateFileSignature(
      payload,
    );

    return payload;
  }

  async createDownloadUrl(
    objectKey: string,
  ): Promise<ReceiptFileUrlResponse> {
    const env =
      parseR2Env(process.env);

    const url =
      await getSignedUrl(
        this.client,

        new GetObjectCommand({
          Bucket:
            env.R2_BUCKET_NAME,

          Key:
            objectKey,
        }),

        {
          expiresIn:
            env.R2_DOWNLOAD_URL_TTL_SECONDS,
        },
      );

    return {
      url,

      expiresInSeconds:
        env.R2_DOWNLOAD_URL_TTL_SECONDS,
    };
  }

  private async validateFileSignature(
    payload:
      ReceiptUploadTokenPayload,
  ): Promise<void> {
    const env =
      parseR2Env(process.env);

    let bytes:
      Buffer;

    try {
      const object =
        await this.client.send(
          new GetObjectCommand({
            Bucket:
              env.R2_BUCKET_NAME,

            Key:
              payload.objectKey,

            Range:
              'bytes=0-15',
          }),
        );

      if (!object.Body) {
        throw new Error(
          'Object body missing.',
        );
      }

      bytes =
        Buffer.from(
          await object.Body
            .transformToByteArray(),
        );
    } catch {
      throw new BadRequestException(
        'Unable to validate uploaded file.',
      );
    }

    let valid =
      false;

    switch (
      payload.mimeType
    ) {
      case 'application/pdf': {
        valid =
          this.startsWith(
            bytes,
            Buffer.from(
              '%PDF-',
              'ascii',
            ),
          );

        break;
      }

      case 'image/jpeg': {
        valid =
          this.startsWith(
            bytes,
            Buffer.from([
              0xff,
              0xd8,
              0xff,
            ]),
          );

        break;
      }

      case 'image/png': {
        valid =
          this.startsWith(
            bytes,
            Buffer.from([
              0x89,
              0x50,
              0x4e,
              0x47,
              0x0d,
              0x0a,
              0x1a,
              0x0a,
            ]),
          );

        break;
      }
    }

    if (!valid) {
      throw new BadRequestException(
        'Uploaded file content does not match its declared type.',
      );
    }
  }

  private startsWith(
    value: Buffer,
    prefix: Buffer,
  ): boolean {
    if (
      value.length <
      prefix.length
    ) {
      return false;
    }

    return value
      .subarray(
        0,
        prefix.length,
      )
      .equals(prefix);
  }
}