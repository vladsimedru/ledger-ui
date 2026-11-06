import { useEffect, useState, type FormEvent } from 'react';
import { api, toApiError, type ApiError } from '../api/client';
import { useLoad } from '../lib/hooks';
import { accountName, isSettlement, useLedger } from '../lib/ledger';
import { href } from '../lib/route';
import type { AccountEntry, Balance } from '../api/types';
import { Amount, Id, Loading, ProblemBox, When } from '../components/common';

export function AccountView({ id }: { id: string }) {
  const { remember } = useLedger();
  const account = useLoad(() => api.account(id).then((r) => r.data), [id]);

  useEffect(() => {
    if (account.data) remember(account.data);
  }, [account.data, remember]);

  if (account.error) return <ProblemBox error={account.error} />;
  if (!account.data) return <Loading />;
  const a = account.data;

  return (
    <section className="stack">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {a.currency} account{isSettlement(a.id) && ' · settlement'}
          </p>
          <h1>{accountName(a, a.id)}</h1>
          <Id value={a.id} />
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={account.reload} disabled={account.loading}>
            Refresh
          </button>
          <a className="button" href={href.newTransaction(a.id)}>
            Record transaction
          </a>
        </div>
      </header>

      <dl className="figures">
        <div>
          <dt>Balance</dt>
          <dd className="big">
            <Amount value={a.balance} currency={a.currency} />
          </dd>
        </div>
        <div>
          <dt>Overdraft limit</dt>
          <dd>{a.overdraftLimit === undefined ? 'No limit' : <Amount value={a.overdraftLimit} currency={a.currency} />}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>
            <When iso={a.createdAt} />
          </dd>
        </div>
      </dl>

      <BalanceAsOf accountId={a.id} />
      <Entries key={`${a.id}:${a.balance}`} accountId={a.id} currency={a.currency} />
    </section>
  );
}

function BalanceAsOf({ accountId }: { accountId: string }) {
  const [when, setWhen] = useState('');
  const [result, setResult] = useState<Balance>();
  const [error, setError] = useState<ApiError>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setResult(undefined);
    try {
      const { data } = await api.balance(accountId, new Date(when).toISOString());
      setResult(data);
    } catch (e) {
      setError(toApiError(e));
    }
  };

  return (
    <form className="inline-form" onSubmit={submit}>
      <label htmlFor="as-of">Balance at a past moment</label>
      <div className="row">
        <input id="as-of" type="datetime-local" step="1" value={when} onChange={(e) => setWhen(e.target.value)} />
        <button type="submit" className="secondary" disabled={!when}>
          Show
        </button>
        {result && (
          <span>
            <Amount value={result.balance} currency={result.currency} /> <span className="muted">as of</span>{' '}
            <When iso={result.asOf} />
          </span>
        )}
      </div>
      {error && <ProblemBox error={error} />}
    </form>
  );
}

function Entries({ accountId, currency }: { accountId: string; currency: string }) {
  const [items, setItems] = useState<AccountEntry[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError>();

  const loadPage = async (after?: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const { data } = await api.entries(accountId, after);
      setItems((previous) => (after ? [...previous, ...data.items] : data.items));
      setCursor(data.nextCursor);
      setDone(!data.nextCursor);
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  return (
    <div className="stack">
      <h2>Entries</h2>
      {error && <ProblemBox error={error} />}
      {items.length === 0 && !busy && !error ? (
        <p className="muted">No entries yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Recorded</th>
                <th>Description</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
                <th className="num">Balance after</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e, i) => (
                <tr key={`${e.transactionId}:${i}`}>
                  <td className="nowrap">
                    <When iso={e.recordedAt} />
                  </td>
                  <td>
                    <a href={href.transaction(e.transactionId)}>{e.description}</a>
                  </td>
                  <td className="num">{e.direction === 'DEBIT' && <Amount value={e.amount} />}</td>
                  <td className="num">{e.direction === 'CREDIT' && <Amount value={e.amount} />}</td>
                  <td className="num">
                    <Amount value={e.balanceAfter} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!done && items.length > 0 && (
        <button type="button" className="secondary" onClick={() => loadPage(cursor)} disabled={busy}>
          {busy ? 'Loading…' : 'Load older entries'}
        </button>
      )}
    </div>
  );
}
