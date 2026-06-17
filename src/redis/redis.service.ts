import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password') || undefined,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  // Key-value operations
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const count = await this.client.incr(key);
    if (ttlSeconds && count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  async setJson(key: string, value: object, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  // Refresh token management
  async saveRefreshToken(userId: string, token: string, ttlSeconds: number): Promise<void> {
    await this.set(`refresh:${userId}`, token, ttlSeconds);
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    return this.get(`refresh:${userId}`);
  }

  async deleteRefreshToken(userId: string): Promise<void> {
    await this.del(`refresh:${userId}`);
  }

  // OTP management
  async saveOtp(phone: string, otp: string, ttlSeconds = 300): Promise<void> {
    await this.set(`otp:${phone}`, otp, ttlSeconds);
  }

  async getOtp(phone: string): Promise<string | null> {
    return this.get(`otp:${phone}`);
  }

  async deleteOtp(phone: string): Promise<void> {
    await this.del(`otp:${phone}`);
  }

  // Cache management
  async cache(key: string, value: object, ttlSeconds = 300): Promise<void> {
    await this.setJson(`cache:${key}`, value, ttlSeconds);
  }

  async getCache<T>(key: string): Promise<T | null> {
    return this.getJson<T>(`cache:${key}`);
  }

  async invalidateCache(pattern: string): Promise<void> {
    const keys = await this.client.keys(`cache:${pattern}*`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // Pub/Sub for WebSocket broadcasting
  async publish(channel: string, message: object): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  createSubscriber(): Redis {
    return this.client.duplicate();
  }
}
