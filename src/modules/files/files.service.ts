import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private readonly driver: 'local' | 's3';
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly localDir: string;
  private readonly appUrl: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('storage.driver') === 'local' ? 'local' : 's3';
    this.appUrl = this.config.get<string>('appUrl');

    this.localDir = path.join(process.cwd(), this.config.get<string>('storage.localDir'));

    const minioEndpoint = config.get<string>('minio.endpoint');
    const minioPort = config.get<number>('minio.port');
    const useSsl = config.get<boolean>('minio.useSsl');
    this.bucket = config.get<string>('minio.bucketName');
    this.endpoint = `${useSsl ? 'https' : 'http'}://${minioEndpoint}:${minioPort}`;

    this.s3 = new S3Client({
      endpoint: this.endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.get<string>('minio.accessKey'),
        secretAccessKey: config.get<string>('minio.secretKey'),
      },
      forcePathStyle: true,
    });
  }

  /**
   * For the 's3' driver: checks the configured bucket exists on boot and
   * creates it if missing, so a fresh MinIO/S3 instance doesn't silently
   * fail every upload. For the 'local' driver: ensures the upload directory
   * exists. Both are resilient by design — if storage is unreachable at
   * boot, this logs a warning and does NOT crash app startup.
   */
  async onModuleInit(): Promise<void> {
    if (this.driver === 'local') {
      try {
        await fs.mkdir(this.localDir, { recursive: true });
        this.logger.log(`Local file storage ready at ${this.localDir}`);
      } catch (err) {
        this.logger.warn(`Could not create local upload directory ${this.localDir}: ${err.message}`);
      }
      return;
    }

    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      try {
        this.logger.warn(
          `Bucket "${this.bucket}" not found or inaccessible (${err.message}); attempting to create it.`,
        );
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket "${this.bucket}" created successfully.`);
      } catch (createErr) {
        this.logger.warn(
          `Could not verify/create bucket "${this.bucket}" — file storage may be unavailable ` +
            `until this is resolved. Continuing app startup. Reason: ${createErr.message}`,
        );
      }
    }
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
    if (this.driver === 'local') {
      return this.uploadLocal(buffer, key);
    }

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return `${this.endpoint}/${this.bucket}/${key}`;
    } catch (err) {
      this.logger.error(`Failed to upload file ${key}: ${err.message}`, err.stack);
      throw new ServiceUnavailableException(
        'File storage is currently unavailable. Please try again later or contact support.',
      );
    }
  }

  private async uploadLocal(buffer: Buffer, key: string): Promise<string> {
    const destination = path.join(this.localDir, key);
    try {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, buffer);
      return `${this.appUrl}/uploads/${key}`;
    } catch (err) {
      this.logger.error(`Failed to write local file ${key}: ${err.message}`, err.stack);
      throw new ServiceUnavailableException(
        'File storage is currently unavailable. Please try again later or contact support.',
      );
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (this.driver === 'local') {
      try {
        await fs.unlink(path.join(this.localDir, key));
      } catch (err) {
        this.logger.error(`Failed to delete local file ${key}: ${err.message}`);
      }
      return;
    }

    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.error(`Failed to delete file ${key}: ${err.message}`);
    }
  }
}
