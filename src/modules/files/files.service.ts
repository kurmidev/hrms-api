import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
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

  async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.error(`Failed to delete file ${key}: ${err.message}`);
    }
  }
}
