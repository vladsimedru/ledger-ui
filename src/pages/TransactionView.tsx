import { useState, type FormEvent } from 'react';
import { api, toApiError, type ApiError } from '../api/client';
import { useIdempotencyKey, useLoad } from '../lib/hooks';
import { useLedger } from '../lib/ledger';
import { go, href } from '../lib/route';
import type { Transaction } from '../api/types';
import { AccountLink, Amount, Id, KeyNote, Loading, ProblemBox, When } from '../components/common';

export function TransactionView({ id }: { id: string }) {
  const transaction = useLoad(() => api.transaction(id).then((r) => r.data), [id]);

  if (transaction.error) return <ProblemBox error={transaction.error} />;
  if (!transaction.data) return <Loading />;
  const t = transaction.data;

  return (
    <section className="stack">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {t.reversesTransactionId ? 'Reversal' : 'Transaction'} · {t.currency}
          </p>
          <h1>{t.description}</h1>
          <Id value={t.id} />
        </div>
      </header>

      <dl className="figures">
        <div>
          <dt>Recorded</dt>
          <dd>
            <When iso={t.recordedAt} />
          </dd>
        </div>
        {t.paymentId && (
          <div>
            <dt>Settled payment</dt>
            <dd className="mono">{t.paymentId}</dd>
          </div>
        )}
        {t.reversesTransactionId && (
          <div>
            <dt>Reverses</dt>
            <dd>
              <a href={href.transaction(t.reversesTransactionId)}>{t.reversesTransactionId.slice(0, 8)}…</a>
            </dd>
          </div>
        )}
        {t.reversedByTransactionId && (
          <div>
            <dt>Reversed by</dt>
            <dd>
              <a href={href.transaction(t.reversedByTransactionId)}>{t.reversedByTransactionId.slice(0, 8)}…</a>
            </dd>
          </div>
        )}
      </dl>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th className="num">Debit</th>
              <th className="num">Credit</th>
            </tr>
          </thead>
          <tbody>
            {t.entries.map((e, i) => (
              <tr key={i}>
                <td>
                  <AccountLink id={e.accountId} />
                </td>
                <td className="num">{e.direction === 'DEBIT' && <Amount value={e.amount} currency={t.currency} />}</td>
                <td className="num">{e.direction === 'CREDIT' && <Amount value={e.amount} currency={t.currency} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Reverse transaction={t} />
    </section>
  );
}

function Reverse({ transaction }: { transaction: Transaction }) {
  const { notify } = useLedger();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError>();
  const { key } = useIdempotencyKey({ id: transaction.id, description: description.trim() });

  if (transaction.reversesTransactionId) {
    return <p className="muted">This is a reversal, so it can't be reversed itself.</p>;
  }
  if (transaction.reversedByTransactionId) {
    return <p className="muted">This transaction has been reversed. Transactions are never edited or deleted.</p>;
  }
  if (!open) {
    return (
      <div className="actions">
        <button type="button" className="secondary" onClick={() => setOpen(true)}>
          Reverse transaction…
        </button>
      </div>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { data, replayed } = await api.reverse(transaction.id, description.trim() || undefined, key);
      notify(replayed ? 'Already reversed: the API replayed the stored response for this key.' : 'Transaction reversed.');
      go(href.transaction(data.id));
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Reverse this transaction</h2>
      <p className="muted">
        Records a new transaction with every entry flipped, so each balance goes back to where it was. The original
        stays in the ledger.
      </p>
      <div className="field">
        <label htmlFor="reversal-description">Description (optional)</label>
        <input
          id="reversal-description"
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={`Reversal of ${transaction.id}`}
        />
      </div>
      {error && <ProblemBox error={error} />}
      <div className="actions">
        <button type="submit" className="danger" disabled={busy}>
          {busy ? 'Reversing…' : 'Confirm reversal'}
        </button>
        <button type="button" className="secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
      <KeyNote idempotencyKey={key} />
    </form>
  );
}
