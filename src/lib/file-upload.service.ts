import { MultipartFile } from '@fastify/multipart';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { pipeline } from 'stream/promises';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

export interface UploadOptions {
  storageType: 'local' | 's3';
  maxFileSize?: number;
  allowedExtensions?: string[];
  uploadDir?: string;
}

export interface UploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
  path: string;
}

export class FileUploadService {
  private options: Required<UploadOptions>;

  constructor(options: UploadOptions = { storageType: 'local' }) {
    this.options = {
      storageType: options.storageType || 'local',
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB default
      allowedExtensions: options.allowedExtensions || [],
      uploadDir: options.uploadDir || join(process.cwd(), 'uploads'),
    };
  }

  /**
   * Upload file
   */
  async upload(file: MultipartFile): Promise<UploadResult> {
    // Validate file size
    if (file.file.bytesRead > this.options.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.options.maxFileSize} bytes`);
    }

    // Validate file extension
    if (this.options.allowedExtensions.length > 0) {
      const ext = extname(file.filename).toLowerCase();
      if (!this.options.allowedExtensions.includes(ext)) {
        throw new Error(`File extension ${ext} is not allowed`);
      }
    }

    // Upload based on storage type
    if (this.options.storageType === 'local') {
      return this.uploadLocal(file);
    } else if (this.options.storageType === 's3') {
      return this.uploadS3(file);
    }

    throw new Error('Invalid storage type');
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
   * Upload to S3 (placeholder - needs AWS SDK)
   */
  private async uploadS3(file: MultipartFile): Promise<UploadResult> {
    // TODO: Implement S3 upload using AWS SDK
    // This is a placeholder implementation
    
    throw new Error('S3 upload not yet implemented. Please use local storage or implement AWS S3 integration.');

    /*
    Example implementation:
    
    import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const ext = extname(file.filename);
    const filename = `${nanoid()}${ext}`;
    const key = `uploads/${filename}`;

    const buffer = await file.toBuffer();

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.mimetype,
    }));

    return {
      filename,
      originalName: file.filename,
      size: buffer.length,
      mimetype: file.mimetype,
      url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      path: key,
    };
    */
  }

  /**
   * Delete file
   */
  async delete(filepath: string): Promise<boolean> {
    if (this.options.storageType === 'local') {
      return this.deleteLocal(filepath);
    } else if (this.options.storageType === 's3') {
      return this.deleteS3(filepath);
    }

    return false;
  }

  /**
   * Delete from local storage
   */
  private async deleteLocal(filepath: string): Promise<boolean> {
    try {
      const { unlink } = await import('fs/promises');
      await unlink(filepath);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete from S3 (placeholder)
   */
  private async deleteS3(key: string): Promise<boolean> {
    // TODO: Implement S3 delete
    throw new Error('S3 delete not yet implemented');

    /*
    Example implementation:
    
    import { DeleteObjectCommand } from '@aws-sdk/client-s3';
    
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    }));
    
    return true;
    */
  }
}

/**
 * Helper to validate file type by MIME type
 */
export function isImageFile(mimetype: string): boolean {
  return mimetype.startsWith('image/');
}

export function isVideoFile(mimetype: string): boolean {
  return mimetype.startsWith('video/');
}

export function isDocumentFile(mimetype: string): boolean {
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  return documentTypes.includes(mimetype);
}
