import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_KEY } from '@shared/constants';
import { PresignedUploadUrlResponse } from '@storage/types';

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private bucket: string;
  private endpoint: string;
  private publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get<string>(ENV_KEY.S3_ENDPOINT, '');
    this.bucket = this.configService.get<string>(ENV_KEY.S3_BUCKET, 'storage-management-bucket');
    this.publicBaseUrl =
      this.configService.get<string>(ENV_KEY.S3_PUBLIC_URL) ?? `${this.endpoint}/${this.bucket}`;

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.configService.get<string>(ENV_KEY.S3_REGION, 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get<string>(ENV_KEY.S3_ACCESS_KEY, ''),
        secretAccessKey: this.configService.get<string>(ENV_KEY.S3_SECRET_KEY, ''),
      },
      forcePathStyle:
        this.configService.get<string>(ENV_KEY.S3_FORCE_PATH_STYLE, 'true').toLowerCase() ===
        'true',
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 bucket '${this.bucket}' is ready.`);
    } catch {
      try {
        this.logger.log(`Creating S3 bucket '${this.bucket}'...`);
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`S3 bucket '${this.bucket}' created successfully.`);
      } catch (err: any) {
        this.logger.warn(
          `Could not auto-create S3 bucket: ${err?.message || err}. Will retry on next request.`,
        );
      }
    }
  }

  async generatePresignedUploadUrl(
    fileName: string,
    mimeType: string,
    folder = 'uploads',
  ): Promise<PresignedUploadUrlResponse> {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 8);
    const fileKey = `${folder}/${timestamp}-${randomHex}-${cleanFileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 900,
      });

      const publicUrl = `${this.publicBaseUrl}/${fileKey}`;

      return {
        uploadUrl,
        fileKey,
        publicUrl,
      };
    } catch (err: any) {
      this.logger.error(`Error generating presigned URL: ${err.message}`, err.stack);
      throw new InternalServerErrorException('Failed to generate presigned upload URL');
    }
  }

  async generatePresignedDownloadUrl(fileKey: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (err: any) {
      this.logger.error(`Error generating download URL: ${err.message}`, err.stack);
      throw new InternalServerErrorException('Failed to generate presigned download URL');
    }
  }

  async uploadBuffer(
    fileKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ key: string; publicUrl: string; bucket: string; size: number }> {
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
          Body: buffer,
          ContentType: mimeType,
        }),
      );

      return {
        key: fileKey,
        bucket: this.bucket,
        publicUrl: `${this.publicBaseUrl}/${fileKey}`,
        size: buffer.length,
      };
    } catch (err: any) {
      this.logger.error(`Failed to upload file to S3: ${err.message}`, err.stack);
      throw new InternalServerErrorException('Failed to upload file to S3 storage');
    }
  }

  async getFileStream(fileKey: string): Promise<{ stream: Readable; contentType: string }> {
    try {
      const res = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        }),
      );

      return {
        stream: res.Body as Readable,
        contentType: res.ContentType || 'application/octet-stream',
      };
    } catch (err: any) {
      if (err.name === 'NoSuchKey') {
        throw new NotFoundException(`File '${fileKey}' not found in S3`);
      }
      throw new InternalServerErrorException(`Failed to retrieve file from S3: ${err.message}`);
    }
  }

  async deleteFile(fileKey: string): Promise<{ key: string; deleted: boolean }> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        }),
      );
      return { key: fileKey, deleted: true };
    } catch (err: any) {
      this.logger.error(`Failed to delete file from S3: ${err.message}`, err.stack);
      throw new InternalServerErrorException('Failed to delete file from S3');
    }
  }

  async checkHealth(): Promise<{ status: string; endpoint: string; bucket: string }> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { status: 'connected', endpoint: this.endpoint, bucket: this.bucket };
    } catch {
      return { status: 'error', endpoint: this.endpoint, bucket: this.bucket };
    }
  }
}
