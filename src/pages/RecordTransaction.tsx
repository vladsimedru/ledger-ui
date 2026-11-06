import { useState, type FormEvent } from 'react';
import { api, toApiError, type ApiError } from '../api/client';
import { useIdempotencyKey } from '../lib/hooks';
import { accountName, useLedger } from '../lib/ledger';
import { formatAmount, fromUnits, toUnits } from '../lib/money';
import { go, href } from '../lib/route';
import type { Direction, EntryRequest, RecordTransactionRequest } from '../api/types';
import { KeyNote, ProblemBox } from '../components/common';

export function RecordTransaction({ from }: { from?: string }) {
  const { accounts, find, notify } = useLedger();
  const [description, setDescription] = useState('');
  const [entries, setEntries] = useState<EntryRequest[]>([
    { accountId: from ?? '', direction: 'DEBIT', amount: '' },
    { accountId: '', direction: 'CREDIT', amount: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError>();

  const request: RecordTransactionRequest = {
    description: description.trim(),
    entries: entries.map((e) => ({ ...e, accountId: e.accountId.trim(), amount: e.amount.trim() })),
  };
  const { key } = useIdempotencyKey(request);

  const update = (index: number, change: Partial<EntryRequest>) =>
    setEntries((list) => list.map((e, i) => (i === index ? { ...e, ...change } : e)));

  // A plain two-entry transfer: typing the debit amount fills an empty credit amount.
  const setAmount = (index: number, amount: string) => {
    setEntries((list) =>
      list.map((e, i) => {
        if (i === index) return { ...e, amount };
        const mirror = list.length === 2 && index === 0 && i === 1 && (e.amount === '' || e.amount === list[0].amount);
        return mirror ? { ...e, amount } : e;
      }),
    );
  };

  const totals = sum(entries);
  const currencies = new Set(entries.map((e) => find(e.accountId.trim())?.currency).filter(Boolean));
  const currency = currencies.size === 1 ? [...currencies][0] : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { data, replayed } = await api.recordTransaction(request, key);
      notify(replayed ? 'Already recorded: the API replayed the stored response for this key.' : 'Transaction recorded.');
      go(href.transaction(data.id));
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack narrow">
      <header>
        <h1>Record a transaction</h1>
        <p className="muted">
          Debits take money out of an account, credits put it in. Debits and credits must add up to the same total,
          in one currency.
        </p>
      </header>

      <datalist id="known-accounts">
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {accountName(a, a.id)} · {a.currency}
          </option>
        ))}
      </datalist>

      <form className="card stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="description">Description</label>
          <input
            id="description"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Payout to merchant 42"
            aria-invalid={!!error?.fieldError('/description')}
          />
          {error?.fieldError('/description') && <p className="field-error">{error.fieldError('/description')}</p>}
        </div>

        <fieldset className="entries">
          <legend>Entries</legend>
          {entries.map((entry, i) => {
            const known = find(entry.accountId.trim());
            const accountError = error?.fieldError(`/entries/${i}/accountId`);
            const amountError = error?.fieldError(`/entries/${i}/amount`) ?? error?.fieldError(`/entries/${i}`);
            return (
              <div className="entry" key={i}>
                <select
                  aria-label={`Entry ${i + 1} direction`}
                  value={entry.direction}
                  onChange={(e) => update(i, { direction: e.target.value as Direction })}
                >
                  <option value="DEBIT">Debit</option>
                  <option value="CREDIT">Credit</option>
                </select>
                <div className="field grow">
                  <input
                    list="known-accounts"
                    aria-label={`Entry ${i + 1} account id`}
                    value={entry.accountId}
                    onChange={(e) => update(i, { accountId: e.target.value })}
                    placeholder="Account id"
                    spellCheck={false}
                    aria-invalid={!!accountError}
                  />
                  <span className="meta">{known ? `${accountName(known, known.id)} · ${known.currency}` : ' '}</span>
                  {accountError && <p className="field-error">{accountError}</p>}
                </div>
                <div className="field amount-field">
                  <input
                    inputMode="decimal"
                    aria-label={`Entry ${i + 1} amount`}
                    value={entry.amount}
                    onChange={(e) => setAmount(i, e.target.value)}
                    placeholder="0.00"
                    aria-invalid={!!amountError}
                  />
                  {amountError && <p className="field-error">{amountError}</p>}
                </div>
                <button
                  type="button"
                  className="link"
                  aria-label={`Remove entry ${i + 1}`}
                  disabled={entries.length <= 2}
                  onClick={() => setEntries((list) => list.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="link add"
            onClick={() => setEntries((list) => [...list, { accountId: '', direction: 'CREDIT', amount: '' }])}
            disabled={entries.length >= 100}
          >
            + Add entry
          </button>
        </fieldset>

        <p className={`totals${totals.balanced ? ' ok' : ''}`}>
          Debits {formatAmount(totals.debits, currency)} · Credits {formatAmount(totals.credits, currency)}
          {totals.balanced ? ' · balanced' : totals.difference ? ` · off by ${formatAmount(totals.difference, currency)}` : ''}
        </p>

        {error && <ProblemBox error={error} />}
        <div className="actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Recording…' : 'Record transaction'}
          </button>
        </div>
        <KeyNote idempotencyKey={key} />
      </form>
    </section>
  );
}

/** Client-side totals, only as a hint: the API decides. */
function sum(entries: EntryRequest[]) {
  let debits = 0n;
  let credits = 0n;
  let complete = true;
  for (const e of entries) {
    const units = toUnits(e.amount);
    if (units === null) {
      complete = false;
      continue;
    }
    if (e.direction === 'DEBIT') debits += units;
    else credits += units;
  }
  const diff = debits - credits;
  return {
    debits: fromUnits(debits),
    credits: fromUnits(credits),
    balanced: complete && debits > 0n && diff === 0n,
    difference: diff === 0n ? '' : fromUnits(diff < 0n ? -diff : diff),
  };
}
