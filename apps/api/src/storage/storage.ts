import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/** Object storage for listing photos. MinIO in production, local folder for dev/tests. */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

export class FsStorage implements Storage {
  constructor(private root: string) {}

  private path(key: string) {
    const p = normalize(join(this.root, key));
    if (!p.startsWith(normalize(this.root))) throw new Error("bad key");
    return p;
  }

  async put(key: string, data: Buffer) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  async get(key: string) {
    return readFile(this.path(key)).catch(() => null);
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
}

export class S3Storage implements Storage {
  private client: S3Client;
  private ready: Promise<void> | null = null;

  constructor(
    private bucket: string,
    opts: { endpoint: string; accessKeyId: string; secretAccessKey: string; region?: string },
  ) {
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region ?? "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  private ensureBucket() {
    this.ready ??= this.client
      .send(new HeadBucketCommand({ Bucket: this.bucket }))
      .then(() => undefined)
      .catch(() => this.client.send(new CreateBucketCommand({ Bucket: this.bucket })).then(() => undefined));
    return this.ready;
  }

  async put(key: string, data: Buffer, contentType: string) {
    await this.ensureBucket();
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }));
  }

  async get(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
