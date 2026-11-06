# Ledger UI

A small React front end for the [Ledger API](../ledger-api): open accounts, see balances and entries,
record transactions and reverse them.

## Run

Start the API first (`./run.sh` in `ledger-api`, which serves it on http://localhost:8080), then:

```sh
npm install
npm run dev        # http://localhost:5173
```

The API sends no CORS headers, so the Vite dev server forwards `/v1/*` to it. To point at another
address: `LEDGER_API_URL=http://localhost:8081 npm run dev`.

`npm run build` type-checks and builds to `dist/`; `npm run preview` serves that build with the same
forwarding.

## What it does

| Screen | API calls |
|---|---|
| Accounts | `GET /v1/accounts/{id}` for each account the browser knows |
| Open account | `POST /v1/accounts` |
| Account | `GET /v1/accounts/{id}`, `GET …/entries` (paged by cursor), `GET …/balance?asOf=` |
| Record transaction | `POST /v1/transactions` with any number of debit and credit entries |
| Transaction | `GET /v1/transactions/{id}`, `POST …/reversal` |

## Design notes

- **Known accounts.** The API has no endpoint that lists accounts, so the UI shows the three
  settlement accounts plus the accounts opened or looked up in this browser (kept in `localStorage`).
  Hiding one only removes it from the list.
- **Idempotency.** Each form keeps one `Idempotency-Key` while its contents stay the same. A retry after
  a network error or a 5xx reuses it, so it can't record twice; editing the form makes a new one. A
  replayed response (`Idempotent-Replayed: true`) is shown as such.
- **Money.** Amounts stay decimal strings, as the API sends them. The running debit/credit totals
  on the transaction form use `BigInt`, so nothing goes through a float. They are only a hint: the
  API applies the rules.
- **Errors.** Problem responses are shown with their `code`, and each `errors[].pointer` is shown
  next to the field it points at (`/entries/1/amount` → the second entry's amount).
- **Tracing.** Every request sends a fresh `X-Request-Id`; errors show it so a failure can be
  found in the API logs.
- No dependencies beyond React; routing is a small hash router (`src/lib/route.ts`).
