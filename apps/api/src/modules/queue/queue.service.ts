import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_KEY } from '@shared/constants';
import type { PgBoss } from 'pg-boss';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private boss: PgBoss | null = null;
  private isStarted = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>(ENV_KEY.DB_HOST, 'localhost');
    const port = +this.configService.get<number>(ENV_KEY.DB_PORT, 5432);
    const user = this.configService.get<string>(ENV_KEY.DB_USERNAME, 'postgres');
    const password = this.configService.get<string>(ENV_KEY.DB_PASSWORD, 'postgres');
    const database = this.configService.get<string>(ENV_KEY.DB_DATABASE, 'storage_management');
    const ssl =
      this.configService.get<string>(ENV_KEY.DB_SSL, 'false').toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : false;

    try {
      const { PgBoss: PgBossClass } = await (Function('return import("pg-boss")')() as Promise<
        typeof import('pg-boss')
      >);

      this.boss = new PgBossClass({
        host,
        port,
        user,
        password,
        database,
        ssl,
        schema: 'pgboss',
        // Maintain reasonable connection defaults
        max: 5,
      });

      this.boss.on('error', (error) => {
        this.logger.error(`pg-boss error: ${error?.message || error}`, error?.stack);
      });

      this.boss.on('warning', (warning) => {
        this.logger.warn(`pg-boss warning: ${warning?.message || warning}`);
      });

      await this.boss.start();
      this.isStarted = true;
      this.logger.log('pg-boss queue initialized and started successfully');
    } catch (err: any) {
      this.logger.error(
        `Failed to start pg-boss: ${err?.message || err}. Queue background processing may be unavailable.`,
        err?.stack,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss && this.isStarted) {
      try {
        await this.boss.stop({ graceful: true, timeout: 5000 });
        this.logger.log('pg-boss stopped cleanly');
      } catch (err: any) {
        this.logger.warn(`Error stopping pg-boss: ${err?.message || err}`);
      }
    }
  }

  /**
   * Pushes a job to the queue.
   */
  async send(name: string, data: object = {}, options: object = {}): Promise<string | null> {
    if (!this.boss || !this.isStarted) {
      this.logger.warn(`Queue not ready, unable to send job ${name}`);
      return null;
    }
    try {
      await this.boss.createQueue(name);
    } catch {
      // Ignore if queue already exists
    }
    return this.boss.send(name, data, options);
  }

  /**
   * Registers a worker handler for a queue.
   */
  async work<T extends object>(
    name: string,
    handler: (job: { id: string; data: T }) => Promise<void>,
  ): Promise<void> {
    if (!this.boss || !this.isStarted) {
      // Retry subscription once queue starts or register directly
      this.logger.warn(`Queue not ready when registering worker for ${name}, will retry...`);
      const checkInterval = setInterval(async () => {
        if (this.boss && this.isStarted) {
          clearInterval(checkInterval);
          await this.registerWorker(name, handler);
        }
      }, 1000);
      return;
    }
    await this.registerWorker(name, handler);
  }

  private async registerWorker<T extends object>(
    name: string,
    handler: (job: { id: string; data: T }) => Promise<void>,
  ): Promise<void> {
    if (!this.boss) return;
    try {
      await this.boss.createQueue(name);
    } catch {
      // Ignore if queue already exists
    }

    await this.boss.work(name, async (jobs: any) => {
      // pg-boss can pass an array of jobs or a single job
      const jobList = Array.isArray(jobs) ? jobs : [jobs];
      for (const job of jobList) {
        try {
          await handler({ id: job.id, data: job.data as T });
        } catch (error: any) {
          this.logger.error(
            `Error processing job ${name} (${job.id}): ${error?.message || error}`,
            error?.stack,
          );
          throw error;
        }
      }
    });
    this.logger.log(`Worker registered for queue '${name}'`);
  }

  getBoss(): PgBoss | null {
    return this.boss;
  }
}
