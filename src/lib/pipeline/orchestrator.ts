import { EventEmitter } from 'node:events';

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface PipelineTask<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  priority?: number;
  timeoutMs?: number;
  retries?: number;
  metadata?: Record<string, unknown>;
  handler: (input: TInput, ctx: PipelineContext) => Promise<TOutput> | TOutput;
  input?: TInput;
}

export interface PipelineContext {
  taskId: string;
  attempt: number;
  signal: AbortSignal;
  log: (msg: string, extra?: Record<string, unknown>) => void;
}

export interface PipelineTaskRecord {
  task: PipelineTask;
  status: TaskStatus;
  attempts: number;
  result?: unknown;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
}

export interface OrchestratorOptions {
  concurrency?: number;
  defaultTimeoutMs?: number;
  defaultRetries?: number;
  retryBackoffMs?: (attempt: number) => number;
  onError?: (record: PipelineTaskRecord, err: unknown) => void;
}

const defaultBackoff = (attempt: number) =>
  Math.min(30_000, 250 * 2 ** Math.max(0, attempt - 1));

export class PipelineOrchestrator extends EventEmitter {
  private readonly queue: PipelineTask[] = [];
  private readonly records = new Map<string, PipelineTaskRecord>();
  private readonly inflight = new Set<string>();
  private readonly concurrency: number;
  private readonly defaultTimeoutMs: number;
  private readonly defaultRetries: number;
  private readonly retryBackoff: (attempt: number) => number;
  private readonly onError?: (
    record: PipelineTaskRecord,
    err: unknown
  ) => void;
  private active = 0;
  private draining: Promise<void> | null = null;

  constructor(opts: OrchestratorOptions = {}) {
    super();
    this.concurrency = Math.max(1, opts.concurrency ?? 4);
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 30_000;
    this.defaultRetries = Math.max(0, opts.defaultRetries ?? 2);
    this.retryBackoff = opts.retryBackoffMs ?? defaultBackoff;
    this.onError = opts.onError;
  }

  enqueue<TInput, TOutput>(
    task: PipelineTask<TInput, TOutput>
  ): PipelineTaskRecord {
    if (!task.id) throw new Error('PipelineTask requires an id');
    if (typeof task.handler !== 'function') {
      throw new Error(`PipelineTask ${task.id} has no handler`);
    }
    const record: PipelineTaskRecord = {
      task: task as PipelineTask,
      status: 'pending',
      attempts: 0,
    };
    this.records.set(task.id, record);
    this.insertByPriority(task as PipelineTask);
    this.emit('enqueued', record);
    void this.drain();
    return record;
  }

  private insertByPriority(task: PipelineTask) {
    const priority = task.priority ?? 0;
    let i = 0;
    while (i < this.queue.length) {
      const current = this.queue[i]!;
      if ((current.priority ?? 0) < priority) break;
      i += 1;
    }
    this.queue.splice(i, 0, task);
  }

  cancel(id: string, reason = 'cancelled'): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    if (record.status === 'running' || record.status === 'completed') return false;
    record.status = 'cancelled';
    record.error = reason;
    record.finishedAt = Date.now();
    this.removeFromQueue(id);
    this.emit('cancelled', record);
    return true;
  }

  private removeFromQueue(id: string) {
    const idx = this.queue.findIndex((t) => t.id === id);
    if (idx >= 0) this.queue.splice(idx, 1);
  }

  getRecord(id: string): PipelineTaskRecord | undefined {
    return this.records.get(id);
  }

  snapshot(): PipelineTaskRecord[] {
    return Array.from(this.records.values()).map((r) => ({ ...r }));
  }

  stats() {
    const acc = {
      total: this.records.size,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      timeout: 0,
    };
    for (const r of this.records.values()) {
      acc[r.status] += 1;
    }
    return acc;
  }

  private async drain(): Promise<void> {
    if (this.draining) return this.draining;
    this.draining = (async () => {
      while (this.queue.length > 0 && this.active < this.concurrency) {
        const task = this.queue.shift();
        if (!task) break;
        const record = this.records.get(task.id);
        if (!record || record.status !== 'pending') continue;
        this.active += 1;
        this.inflight.add(task.id);
        void this.runTask(task, record).finally(() => {
          this.active -= 1;
          this.inflight.delete(task.id);
          if (
            (this.queue.length > 0 || this.active > 0) &&
            this.draining
          ) {
            void this.drain();
          } else if (this.queue.length === 0 && this.active === 0) {
            this.draining = null;
          }
        });
      }
      if (this.queue.length === 0 && this.active === 0) {
        this.draining = null;
      }
    })();
    return this.draining;
  }

  private async runTask(
    task: PipelineTask,
    record: PipelineTaskRecord
  ): Promise<void> {
    const maxAttempts = (task.retries ?? this.defaultRetries) + 1;
    const timeoutMs = task.timeoutMs ?? this.defaultTimeoutMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      record.attempts = attempt;
      record.status = 'running';
      record.startedAt = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
      const ctx: PipelineContext = {
        taskId: task.id,
        attempt,
        signal: controller.signal,
        log: (msg, extra) =>
          this.emit('log', { taskId: task.id, msg, extra, attempt }),
      };

      this.emit('start', { record, attempt });
      try {
        const result = await Promise.resolve(task.handler(task.input, ctx));
        clearTimeout(timer);
        record.status = 'completed';
        record.result = result;
        record.finishedAt = Date.now();
        record.durationMs = record.finishedAt - record.startedAt!;
        this.emit('success', record);
        return;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        const timedOut =
          controller.signal.aborted &&
          (controller.signal.reason === 'timeout' ||
            String((err as Error)?.name) === 'AbortError' ||
            String((err as Error)?.message).toLowerCase().includes('timeout'));

        if (timedOut) {
          record.status = 'timeout';
          record.error = (err as Error)?.message ?? 'Task timed out';
        } else {
          record.status = 'failed';
          record.error =
            err instanceof Error ? err.message : String(err ?? 'unknown');
        }
        this.onError?.(record, err);
        this.emit('failure', { record, err, attempt });

        if (attempt < maxAttempts) {
          const delay = this.retryBackoff(attempt);
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }

    if (record.status !== 'timeout') record.status = 'failed';
    record.finishedAt = Date.now();
    record.durationMs = record.startedAt
      ? record.finishedAt - record.startedAt
      : undefined;
    this.emit('done', { record, finalError: lastError });
  }

  async whenIdle(): Promise<void> {
    while (this.queue.length > 0 || this.active > 0 || this.draining) {
      await new Promise((res) => setTimeout(res, 25));
    }
  }
}

export function createOrchestrator(
  options?: OrchestratorOptions
): PipelineOrchestrator {
  return new PipelineOrchestrator(options);
}
