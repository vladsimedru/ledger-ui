// Shapes from the ledger API contract (ledger-api/api/openapi.yaml).

export type Direction = 'DEBIT' | 'CREDIT';

export interface Account {
  id: string;
  currency: string;
  /** Absent for the ledger's own settlement accounts, which have no limit. */
  overdraftLimit?: string;
  balance: string;
  label?: string;
  createdAt: string;
}

export interface Balance {
  accountId: string;
  currency: string;
  balance: string;
  asOf: string;
}

export interface EntryRequest {
  accountId: string;
  direction: Direction;
  amount: string;
}

export type Entry = EntryRequest;

export interface Transaction {
  id: string;
  description: string;
  currency: string;
  recordedAt: string;
  reversesTransactionId?: string;
  reversedByTransactionId?: string;
  paymentId?: string;
  entries: Entry[];
}

export interface AccountEntry {
  transactionId: string;
  description: string;
  direction: Direction;
  amount: string;
  balanceAfter: string;
  recordedAt: string;
}

export interface AccountEntryPage {
  items: AccountEntry[];
  nextCursor?: string;
}

export interface OpenAccountRequest {
  currency: string;
  overdraftLimit?: string;
  label?: string;
}

export interface RecordTransactionRequest {
  description: string;
  entries: EntryRequest[];
}

export interface FieldError {
  pointer?: string;
  code: string;
  detail: string;
}

/** RFC 9457 problem details, as the API returns them. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  requestId?: string;
  errors?: FieldError[];
}
