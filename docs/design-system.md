# ShiftProof interface system

ShiftProof treats each important state as a mark acquired by a record.

## Visual language

- Warm paper `#F8F5EE`
- Light surface `#FCFAF6`
- Navy ink `#0B2033`
- Approved green `#258447`
- Attention amber `#EB8624`
- Warm hairline `#D8D5CD`
- Space Grotesk for product UI
- IBM Plex Mono only for IDs, timestamps, and compact evidence metadata

The interface is primarily contemporary product UI with a restrained ledger/receipt metaphor. Hours use strong hierarchy and tabular numerals. Rows, alignment, and whitespace carry more structure than rounded cards.

## State marks

- `○` — not recorded
- outlined mark — stored locally or waiting to synchronize
- `●` — recorded and reconciled
- amber `!` — needs calm human review
- approved receipt — a permanent decision with ID and timestamp

Text labels and accessibility descriptions accompany every mark; color is never the only signal.

## Reusable surfaces

`ProofMark`, `LedgerRow`, `HoursDisplay`, `ConnectivityStatus`, `ProofSlip`, `StatusLabel`, `PeriodHeader`, `PrimaryAction`, and `BottomNavigation` carry the same vocabulary across screens.

