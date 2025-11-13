import { MultipartFile } from "@fastify/multipart";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import { customAlphabet } from "nanoid";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

export interface UploadOptions {
  storageType: "local" | "s3";
  maxFileSize?: number;
  allowedExtensions?: string[];
  uploadDir?: string;
  // S3 specific options
  s3Config?: {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
    endpoint?: string; // For S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
    pathPrefix?: string; // Prefix for S3 keys (e.g., "uploads/", "project-123/")
    publicUrl?: string; // Custom public URL (for CDN or custom domain)
  };
}

export interface UploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
  path: string;
  // S3 specific
  bucket?: string;
  key?: string;
}

export class FileUploadService {
  private options: Required<Omit<UploadOptions, "s3Config">> & {
    s3Config?: UploadOptions["s3Config"];
  };
  private s3Client: S3Client | null = null;

  constructor(options: UploadOptions = { storageType: "local" }) {
    this.options = {
      storageType: options.storageType || "local",
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB default
      allowedExtensions: options.allowedExtensions || [],
      uploadDir: options.uploadDir || join(process.cwd(), "uploads"),
      s3Config: options.s3Config,
    };

    // Initialize S3 client if S3 storage is used
    if (this.options.storageType === "s3") {
      this.initializeS3Client();
    }
  }

  /**
   * Initialize S3 client
   */
  private initializeS3Client(): void {
    const config = this.options.s3Config || {};

    const s3Config: any = {
      region: config.region || process.env.AWS_REGION || "us-east-1",
    };

    // Credentials
    if (config.accessKeyId && config.secretAccessKey) {
      s3Config.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    } else if (
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    ) {
      s3Config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    // Custom endpoint (for S3-compatible services)
    if (config.endpoint) {
      s3Config.endpoint = config.endpoint;
      s3Config.forcePathStyle = true; // Required for some S3-compatible services
    }

    this.s3Client = new S3Client(s3Config);
  }

  /**
   * Get S3 bucket name
   */
  private getBucketName(): string {
    const config = this.options.s3Config;
    return (
      config?.bucketName ||
      process.env.AWS_BUCKET_NAME ||
      process.env.S3_BUCKET_NAME ||
      ""
    );
  }

  /**
   * Get S3 key (path) for file
   */
  private getS3Key(filename: string, prefix?: string): string {
    const pathPrefix =
      prefix || this.options.s3Config?.pathPrefix || "uploads/";
    // Ensure prefix ends with /
    const normalizedPrefix = pathPrefix.endsWith("/")
      ? pathPrefix
      : `${pathPrefix}/`;
    return `${normalizedPrefix}${filename}`;
  }

  /**
   * Get public URL for S3 object
   */
  private getS3PublicUrl(key: string): string {
    const config = this.options.s3Config;
    const bucketName = this.getBucketName();
    const region = config?.region || process.env.AWS_REGION || "us-east-1";

    // Custom public URL (for CDN)
    if (config?.publicUrl) {
      return `${config.publicUrl}/${key}`;
    }

    // Custom endpoint (for S3-compatible services)
    if (config?.endpoint) {
      return `${config.endpoint}/${bucketName}/${key}`;
    }

    // Standard AWS S3 URL
    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Convert stream to buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Upload file
   */
  async upload(file: MultipartFile): Promise<UploadResult> {
    // Validate file size
    if (file.file.bytesRead > this.options.maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${this.options.maxFileSize} bytes`
      );
    }

    // Validate file extension
    if (this.options.allowedExtensions.length > 0) {
      const ext = extname(file.filename).toLowerCase();
      if (!this.options.allowedExtensions.includes(ext)) {
        throw new Error(`File extension ${ext} is not allowed`);
      }
    }

    // Upload based on storage type
    if (this.options.storageType === "local") {
      return this.uploadLocal(file);
    } else if (this.options.storageType === "s3") {
      return this.uploadS3(file);
    }

    throw new Error("Invalid storage type");
  }

  /**
   * Upload to local storage
   */
  private async uploadLocal(file: MultipartFile): Promise<UploadResult> {
    // Generate unique filename
    const ext = extname(file.filename);
    const filename = `${nanoid()}${ext}`;
    const filepath = join(this.options.uploadDir, filename);

    // Ensure upload directory exists
    await mkdir(this.options.uploadDir, { recursive: true });

    // Save file
    await pipeline(file.file, createWriteStream(filepath));

    return {
      filename,
      originalName: file.filename,
      size: file.file.bytesRead,
      mimetype: file.mimetype,
      url: `/uploads/${filename}`, // Relative URL
      path: filepath, // Absolute path
    };
  }

  /**
   * Upload to S3
   */
  private async uploadS3(file: MultipartFile): Promise<UploadResult> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    const bucketName = this.getBucketName();
    if (!bucketName) {
      throw new Error("S3 bucket name is required");
    }

    // Generate unique filename
    const ext = extname(file.filename);
    const filename = `${nanoid()}${ext}`;
    const key = this.getS3Key(filename);

    // Convert stream to buffer
    const buffer = await this.streamToBuffer(file.file);

    // Upload to S3
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: buffer,
          ContentType: file.mimetype || "application/octet-stream",
          // Optional: Add metadata
          Metadata: {
            originalName: file.filename,
            uploadedAt: new Date().toISOString(),
          },
        })
      );
    } catch (err: any) {
      throw new Error(`Failed to upload to S3: ${err.message}`);
    }

    // Get public URL
    const url = this.getS3PublicUrl(key);

    return {
      filename,
      originalName: file.filename,
      size: buffer.length,
      mimetype: file.mimetype || "application/octet-stream",
      url,
      path: key,
      bucket: bucketName,
      key,
    };
  }

  /**
   * Delete file
   */
  async delete(filepath: string): Promise<boolean> {
    if (this.options.storageType === "local") {
      return this.deleteLocal(filepath);
    } else if (this.options.storageType === "s3") {
      return this.deleteS3(filepath);
    }

    return false;
  }

  /**
   * Delete from local storage
   */
  private async deleteLocal(filepath: string): Promise<boolean> {
    try {
      const { unlink } = await import("fs/promises");
      await unlink(filepath);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete from S3
   */
  private async deleteS3(key: string): Promise<boolean> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    const bucketName = this.getBucketName();
    if (!bucketName) {
      throw new Error("S3 bucket name is required");
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );
      return true;
    } catch (err: any) {
      throw new Error(`Failed to delete from S3: ${err.message}`);
    }
  }

  /**
   * Generate presigned URL for S3 object (for temporary access)
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    const bucketName = this.getBucketName();
    if (!bucketName) {
      throw new Error("S3 bucket name is required");
    }

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (err: any) {
      throw new Error(`Failed to generate presigned URL: ${err.message}`);
    }
  }
}

/**
 * Helper to validate file type by MIME type
 */
export function isImageFile(mimetype: string): boolean {
  return mimetype.startsWith("image/");
}

export function isVideoFile(mimetype: string): boolean {
  return mimetype.startsWith("video/");
}

export function isDocumentFile(mimetype: string): boolean {
  const documentTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  return documentTypes.includes(mimetype);
}
