import { useState, type FormEvent } from 'react';
import { api, toApiError, type ApiError } from '../api/client';
import { useLoad } from '../lib/hooks';
import { accountName, isSettlement, useLedger } from '../lib/ledger';
import { go, href } from '../lib/route';
import type { Account } from '../api/types';
import { Amount, Loading, ProblemBox } from '../components/common';

type Row = { id: string; account?: Account; error?: ApiError };

export function Overview() {
  const { accounts, remember, forget } = useLedger();
  const ids = accounts.map((a) => a.id);
  const rows = useLoad<Row[]>(
    () =>
      Promise.all(
        ids.map((id) =>
          api.account(id).then(
            (r) => ({ id, account: r.data }),
            (e) => ({ id, error: toApiError(e) }),
          ),
        ),
      ),
    [ids.join()],
  );

  const [lookup, setLookup] = useState('');
  const [lookupError, setLookupError] = useState<ApiError>();

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setLookupError(undefined);
    try {
      const { data } = await api.account(lookup.trim());
      remember(data);
      setLookup('');
    } catch (e) {
      setLookupError(toApiError(e));
    }
  };

  return (
    <section className="stack">
      <header className="page-head">
        <div>
          <h1>Accounts</h1>
          <p className="muted">Accounts opened or looked up in this browser, and the ledger's settlement accounts.</p>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={rows.reload} disabled={rows.loading}>
            Refresh
          </button>
          <a className="button" href={href.openAccount}>
            Open account
          </a>
        </div>
      </header>

      {!rows.data && rows.loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Currency</th>
                <th className="num">Overdraft limit</th>
                <th className="num">Balance</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {(rows.data ?? []).map(({ id, account, error }) => {
                const known = accounts.find((a) => a.id === id);
                return (
                  <tr key={id} className="clickable" onClick={() => go(href.account(id))}>
                    <td>
                      <a href={href.account(id)} onClick={(e) => e.stopPropagation()}>
                        {accountName(account ?? known, id)}
                      </a>
                      {isSettlement(id) && <span className="tag">settlement</span>}
                      <div className="meta">{id}</div>
                    </td>
                    <td>{account?.currency ?? known?.currency}</td>
                    <td className="num">
                      {account &&
                        (account.overdraftLimit === undefined ? (
                          <span className="muted">no limit</span>
                        ) : (
                          <Amount value={account.overdraftLimit} />
                        ))}
                    </td>
                    <td className="num">
                      {account ? <Amount value={account.balance} /> : <span className="error-text">{error?.message}</span>}
                    </td>
                    <td className="num">
                      {!isSettlement(id) && (
                        <button
                          type="button"
                          className="link"
                          title="Remove from this list. The account stays in the ledger."
                          onClick={(e) => {
                            e.stopPropagation();
                            forget(id);
                          }}
                        >
                          Hide
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form className="inline-form" onSubmit={add}>
        <label htmlFor="lookup">Add an existing account by id</label>
        <div className="row">
          <input
            id="lookup"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="0195f3a2-…"
            spellCheck={false}
          />
          <button type="submit" className="secondary" disabled={!lookup.trim()}>
            Add
          </button>
        </div>
      </form>
      {lookupError && <ProblemBox error={lookupError} />}
    </section>
  );
}
