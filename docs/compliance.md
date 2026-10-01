# Record checks

`npm run fulfil -- compliance` checks the records against the rules below. Sources checked 1 October 2026. These checks flag records for a responsible person. They are not legal or tax advice, they do not notify anyone, and a clean result does not certify compliance. Confirm each rule with your adviser before relying on it, and change it with `/customise` when yours differs.

| Rule | What the check flags | Source |
|---|---|---|
| NZ-IPP9 / AU-APP11.2 | A client with no retention period for recipient details, and any despatched or cancelled order whose recipient details are older than that period and not yet redacted. Orders with a pending return are left alone. | NZ: [Privacy Principle 9](https://www.privacy.org.nz/privacy-principles/9/), an agency must not keep personal information longer than required for the purposes it may lawfully be used for. AU: [APP 11.2](https://www.oaic.gov.au/privacy/australian-privacy-principles/read-the-australian-privacy-principles), an APP entity takes reasonable steps to destroy or de-identify personal information it no longer needs. |
| NZ-IRD-7Y / AU-ATO-5Y | A billing run whose retain-until date is less than seven years after the end of its period. Seven years covers both countries. | NZ: [Inland Revenue record keeping](https://www.ird.govt.nz/managing-my-tax/record-keeping), keep business records for at least seven years. AU: [ATO overview of record-keeping rules](https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/record-keeping-for-business/overview-of-record-keeping-rules-for-business), keep business records for five years. |
| POLICY-DG | A despatched order holding a SKU marked as dangerous goods that went on a courier service not marked as accepting them. `despatch` refuses this for new orders; the check finds history and imports. | Warehouse operating policy. Each carrier sets its own dangerous goods terms: record them on the service with `accepts_dg` only when the carrier has agreed them in writing. |

## How the retention period works

Each client has `personal_data_days`: how long you keep a shopper's name, email, phone and street address after despatch. Agree it with the client, because the client decides what it needs for returns, warranty and fraud checks. `redact --dry-run` lists what is due; `redact` replaces the name with "Redacted" and clears email, phone and street address. The postcode, country, order lines, tracking and billing stay, so the order still counts in billing and despatch history.

Whether the Australian Privacy Act applies to your business depends on your turnover and activities. Read the OAIC guidance or ask your adviser. The check runs either way, because keeping shopper details for no reason is a risk on its own.

## What this does not cover

Dangerous goods classification, packaging and labelling, food safety, customs, product safety recalls and health and safety notification are outside this base. Record them with `/customise` once your rules are confirmed.
