import { useState, type FormEvent } from 'react';
import { api, toApiError, type ApiError } from '../api';
import { useIdempotencyKey } from '../hooks';
import { useLedger } from '../ledger';
import { CURRENCIES, DECIMALS } from '../money';
import { go, href } from '../route';
import type { OpenAccountRequest } from '../types';
import { KeyNote, ProblemBox } from './common';

export function OpenAccount() {
  const { remember, notify } = useLedger();
  const [currency, setCurrency] = useState<string>('EUR');
  const [overdraftLimit, setOverdraftLimit] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError>();

  const request: OpenAccountRequest = {
    currency,
    overdraftLimit: overdraftLimit.trim() || undefined,
    label: label.trim() || undefined,
  };
  const { key } = useIdempotencyKey(request);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { data, replayed } = await api.openAccount(request, key);
      remember(data);
      notify(replayed ? 'Already opened: the API replayed the stored response for this key.' : 'Account opened.');
      go(href.account(data.id));
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack narrow">
      <header>
        <h1>Open an account</h1>
        <p className="muted">A new account starts at zero. It can't go below minus its overdraft limit.</p>
      </header>
      <form className="card stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="label">Label</label>
          <input id="label" value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} placeholder="Merchant 42" />
        </div>
        <div className="field">
          <label htmlFor="currency">Currency</label>
          <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} · {DECIMALS[c]} decimals
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="overdraft">Overdraft limit</label>
          <input
            id="overdraft"
            inputMode="decimal"
            value={overdraftLimit}
            onChange={(e) => setOverdraftLimit(e.target.value)}
            placeholder="0"
            aria-invalid={!!error?.fieldError('/overdraftLimit')}
          />
          {error?.fieldError('/overdraftLimit') && <p className="field-error">{error.fieldError('/overdraftLimit')}</p>}
        </div>
        {error && <ProblemBox error={error} />}
        <div className="actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Opening…' : 'Open account'}
          </button>
          <a href={href.overview} className="button secondary">
            Cancel
          </a>
        </div>
        <KeyNote idempotencyKey={key} />
      </form>
    </section>
  );
}
