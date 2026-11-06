import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { AccountView } from './pages/AccountView';
import { OpenAccount } from './pages/OpenAccount';
import { Overview } from './pages/Overview';
import { RecordTransaction } from './pages/RecordTransaction';
import { TransactionView } from './pages/TransactionView';
import { api } from './api/client';
import {
  LedgerContext,
  SETTLEMENT_ACCOUNTS,
  isSettlement,
  loadRemembered,
  saveRemembered,
  type KnownAccount,
  type Ledger,
} from './lib/ledger';
import { go, href, useRoute, type Route } from './lib/route';
import type { Account } from './api/types';

export function App() {
  const route = useRoute();
  const [remembered, setRemembered] = useState<KnownAccount[]>(loadRemembered);
  const [flash, setFlash] = useState<string>();

  const update = useCallback((change: (list: KnownAccount[]) => KnownAccount[]) => {
    setRemembered((list) => {
      const next = change(list);
      if (next !== list) saveRemembered(next);
      return next;
    });
  }, []);

  const remember = useCallback(
    (account: Account) => {
      if (isSettlement(account.id)) return;
      update((list) => {
        const known: KnownAccount = { id: account.id, currency: account.currency, label: account.label };
        const existing = list.find((a) => a.id === account.id);
        if (existing && existing.label === known.label && existing.currency === known.currency) return list;
        return existing ? list.map((a) => (a.id === account.id ? known : a)) : [...list, known];
      });
    },
    [update],
  );

  const forget = useCallback((id: string) => update((list) => list.filter((a) => a.id !== id)), [update]);

  const ledger = useMemo<Ledger>(() => {
    const accounts = [...SETTLEMENT_ACCOUNTS, ...remembered];
    return {
      accounts,
      remember,
      forget,
      find: (id) => accounts.find((a) => a.id === id),
      notify: setFlash,
    };
  }, [remembered, remember, forget]);

  return (
    <LedgerContext.Provider value={ledger}>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={href.overview}>
            Ledger
          </a>
          <nav>
            <a href={href.overview} aria-current={route.name === 'overview' ? 'page' : undefined}>
              Accounts
            </a>
            <a href={href.openAccount} aria-current={route.name === 'open-account' ? 'page' : undefined}>
              Open account
            </a>
            <a href={href.newTransaction()} aria-current={route.name === 'new-transaction' ? 'page' : undefined}>
              Record transaction
            </a>
          </nav>
          <Lookup />
        </div>
      </header>
      <main>
        {flash && (
          <div className="flash" role="status">
            <span>{flash}</span>
            <button type="button" className="link" onClick={() => setFlash(undefined)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}
        <Page route={route} />
      </main>
    </LedgerContext.Provider>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'overview':
      return <Overview />;
    case 'open-account':
      return <OpenAccount />;
    case 'account':
      return <AccountView key={route.id} id={route.id} />;
    case 'new-transaction':
      return <RecordTransaction key={route.from ?? ''} from={route.from} />;
    case 'transaction':
      return <TransactionView key={route.id} id={route.id} />;
    case 'not-found':
      return (
        <p>
          Nothing here. <a href={href.overview}>Back to accounts</a>
        </p>
      );
  }
}

/** Jumps to an account or a transaction by id; the API has a separate endpoint for each. */
function Lookup() {
  const [value, setValue] = useState('');
  const [missing, setMissing] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const id = value.trim();
    if (!id) return;
    setMissing(false);
    const [account, transaction] = await Promise.allSettled([api.account(id), api.transaction(id)]);
    if (account.status === 'fulfilled') go(href.account(id));
    else if (transaction.status === 'fulfilled') go(href.transaction(id));
    else return setMissing(true);
    setValue('');
  };

  return (
    <form className="lookup" onSubmit={submit} role="search">
      <input
        aria-label="Find an account or transaction by id"
        placeholder={missing ? 'Not found' : 'Find by id'}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setMissing(false);
        }}
        aria-invalid={missing}
        spellCheck={false}
      />
    </form>
  );
}
