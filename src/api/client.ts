import type {
  Account,
  AccountEntryPage,
  Balance,
  OpenAccountRequest,
  Problem,
  RecordTransactionRequest,
  Transaction,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Problem | null,
    readonly requestId: string,
  ) {
    super(problem?.title ?? (status === 0 ? "Couldn't reach the ledger API" : `HTTP ${status}`));
  }

  /** Nothing was recorded; sending the same request with the same key is safe. */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }

  /** The detail for one part of the request body, by JSON Pointer. */
  fieldError(pointer: string): string | undefined {
    return this.problem?.errors?.find((e) => e.pointer === pointer)?.detail;
  }
}

export function toApiError(e: unknown): ApiError {
  return e instanceof ApiError ? e : new ApiError(0, null, '-');
}

export interface Result<T> {
  data: T;
  /** The API returned the response it stored for this Idempotency-Key. */
  replayed: boolean;
}

async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  options: { body?: unknown; idempotencyKey?: string } = {},
): Promise<Result<T>> {
  const requestId = crypto.randomUUID();
  const headers: Record<string, string> = {
    Accept: 'application/json, application/problem+json',
    'X-Request-Id': requestId,
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, null, requestId);
  }

  const echoedId = response.headers.get('X-Request-Id') ?? requestId;
  const json = parse(await response.text());
  if (!response.ok) {
    throw new ApiError(response.status, isProblem(json) ? json : null, echoedId);
  }
  return { data: json as T, replayed: response.headers.get('Idempotent-Replayed') === 'true' };
}

function parse(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function isProblem(value: unknown): value is Problem {
  return typeof value === 'object' && value !== null && 'code' in value && 'title' in value;
}

const seg = encodeURIComponent;

export const api = {
  openAccount: (body: OpenAccountRequest, idempotencyKey: string) =>
    call<Account>('POST', '/v1/accounts', { body, idempotencyKey }),

  account: (accountId: string) => call<Account>('GET', `/v1/accounts/${seg(accountId)}`),

  entries: (accountId: string, cursor?: string, limit = 20) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set('cursor', cursor);
    return call<AccountEntryPage>('GET', `/v1/accounts/${seg(accountId)}/entries?${query}`);
  },

  balance: (accountId: string, asOf: string) =>
    call<Balance>('GET', `/v1/accounts/${seg(accountId)}/balance?${new URLSearchParams({ asOf })}`),

  recordTransaction: (body: RecordTransactionRequest, idempotencyKey: string) =>
    call<Transaction>('POST', '/v1/transactions', { body, idempotencyKey }),

  transaction: (transactionId: string) => call<Transaction>('GET', `/v1/transactions/${seg(transactionId)}`),

  reverse: (transactionId: string, description: string | undefined, idempotencyKey: string) =>
    call<Transaction>('POST', `/v1/transactions/${seg(transactionId)}/reversal`, {
      body: description ? { description } : {},
      idempotencyKey,
    }),
};
