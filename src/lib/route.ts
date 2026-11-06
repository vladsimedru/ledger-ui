import { useEffect, useState } from 'react';

export type Route =
  | { name: 'overview' }
  | { name: 'open-account' }
  | { name: 'account'; id: string }
  | { name: 'new-transaction'; from?: string }
  | { name: 'transaction'; id: string }
  | { name: 'not-found' };

export const href = {
  overview: '#/',
  openAccount: '#/accounts/new',
  account: (id: string) => `#/accounts/${id}`,
  newTransaction: (from?: string) => (from ? `#/transactions/new/${from}` : '#/transactions/new'),
  transaction: (id: string) => `#/transactions/${id}`,
};

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [section, first, second] = parts;
  if (!section) return { name: 'overview' };
  if (section === 'accounts' && first === 'new' && !second) return { name: 'open-account' };
  if (section === 'accounts' && first && !second) return { name: 'account', id: first };
  if (section === 'transactions' && first === 'new') return { name: 'new-transaction', from: second };
  if (section === 'transactions' && first && !second) return { name: 'transaction', id: first };
  return { name: 'not-found' };
}

export function go(hash: string) {
  window.location.hash = hash;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
