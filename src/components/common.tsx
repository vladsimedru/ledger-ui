import { useState } from 'react';
import type { ApiError } from '../api/client';
import { accountName, useLedger } from '../lib/ledger';
import { formatAmount, isNegative } from '../lib/money';
import { href } from '../lib/route';

export function Amount({ value, currency }: { value: string; currency?: string }) {
  return <span className={`amount${isNegative(value) ? ' negative' : ''}`}>{formatAmount(value, currency)}</span>;
}

export function AccountLink({ id }: { id: string }) {
  const { find } = useLedger();
  return <a href={href.account(id)}>{accountName(find(id), id)}</a>;
}

export function Id({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => undefined,
    );
  };
  return (
    <button type="button" className="id" onClick={copy} title="Copy id">
      {copied ? 'copied' : value}
    </button>
  );
}

export function When({ iso }: { iso: string }) {
  const date = new Date(iso);
  return <time dateTime={iso} title={iso}>{date.toLocaleString()}</time>;
}

/** "/entries/1/amount" → "Entry 2 · amount" */
export function describePointer(pointer: string): string {
  const parts = pointer.split('/').filter(Boolean);
  const words: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'entries' && /^\d+$/.test(parts[i + 1] ?? '')) {
      words.push(`Entry ${Number(parts[i + 1]) + 1}`);
      i++;
    } else {
      words.push(parts[i]);
    }
  }
  return words.join(' · ') || 'request';
}

export function ProblemBox({ error }: { error: ApiError }) {
  const problem = error.problem;
  return (
    <div className="problem" role="alert">
      <div className="problem-head">
        <strong>{error.message}</strong>
        {problem?.code && <code>{problem.code}</code>}
      </div>
      {problem?.detail && <p>{problem.detail}</p>}
      {problem?.errors && problem.errors.length > 0 && (
        <ul>
          {problem.errors.map((e, i) => (
            <li key={i}>
              {e.pointer && <span className="pointer">{describePointer(e.pointer)}</span>} {e.detail}
            </li>
          ))}
        </ul>
      )}
      {error.retryable && (
        <p className="hint">
          Nothing was recorded. Submitting again reuses the same Idempotency-Key, so it can't be recorded twice.
        </p>
      )}
      <p className="meta">X-Request-Id {error.requestId}</p>
    </div>
  );
}

export function KeyNote({ idempotencyKey }: { idempotencyKey: string }) {
  return (
    <p className="meta" title="Sent as the Idempotency-Key header. It stays the same until you change the form.">
      Idempotency-Key {idempotencyKey}
    </p>
  );
}

export function Loading() {
  return <p className="muted">Loading…</p>;
}
