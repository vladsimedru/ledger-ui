import { createContext, useContext } from 'react';
import type { Account } from '../api/types';

/** An account this browser knows about. The API has no "list accounts" endpoint. */
export interface KnownAccount {
  id: string;
  currency: string;
  label?: string;
}

/** The ledger's own accounts, created by migration V2 in ledger-api. */
export const SETTLEMENT_ACCOUNTS: KnownAccount[] = [
  { id: '00000000-0000-0000-0000-000000000978', currency: 'EUR', label: 'Settlement EUR' },
  { id: '00000000-0000-0000-0000-000000000840', currency: 'USD', label: 'Settlement USD' },
  { id: '00000000-0000-0000-0000-000000000392', currency: 'JPY', label: 'Settlement JPY' },
];

const STORAGE_KEY = 'ledger-ui.accounts';

export function loadRemembered(): KnownAccount[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((a) => typeof a?.id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveRemembered(list: KnownAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: the list only lasts for this tab.
  }
}

export function isSettlement(id: string): boolean {
  return SETTLEMENT_ACCOUNTS.some((a) => a.id === id);
}

export interface Ledger {
  accounts: KnownAccount[];
  remember: (account: Account) => void;
  forget: (id: string) => void;
  find: (id: string) => KnownAccount | undefined;
  notify: (message: string) => void;
}

export const LedgerContext = createContext<Ledger | null>(null);

export function useLedger(): Ledger {
  const ledger = useContext(LedgerContext);
  if (!ledger) throw new Error('useLedger used outside LedgerContext');
  return ledger;
}

export function accountName(account: KnownAccount | undefined, id: string): string {
  return account?.label || `Account ${id.slice(0, 8)}…`;
}
