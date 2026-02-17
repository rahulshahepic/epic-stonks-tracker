import { useState } from 'react';

const SCHEMA_REF = `{
  "grants": [
    {
      "id": "unique-string",
      "type": "purchase" | "free" | "catch_up" | "bonus",
      "grantDate": "YYYY-MM-DD",
      "totalShares": number,
      "pricePerShareAtGrant": number,
      "vestingSchedule": [
        {
          "id": "unique-string",
          "vestDate": "YYYY-MM-DD",
          "numberOfShares": number,
          "taxTreatment": "income" | "capital_gains" | "none"
        }
      ],
      "relatedGrantId": "optional - ID of parent purchase grant",
      "notes": "optional"
    }
  ],
  "loans": [
    {
      "id": "unique-string",
      "type": "purchase" | "tax" | "interest",
      "principalAmount": number,
      "annualInterestRate": 0.04,  // decimal, NOT percentage
      "originationDate": "YYYY-MM-DD",
      "maturityDate": "YYYY-MM-DD",
      "status": "active" | "refinanced" | "paid_off",
      "relatedGrantId": "optional - which grant this loan is for",
      "parentLoanId": "optional - for interest/tax loans linked to a parent",
      "refinancedFromId": "optional - ID of the loan this replaces",
      "notes": "optional"
    }
  ],
  "stockPrices": [
    {
      "date": "YYYY-MM-DD",
      "pricePerShare": number
    }
  ]
}`;

const PROMPT_TEMPLATE = `I need you to convert my stock/loan data into a specific JSON format for import into a portfolio tracker. Here is the target schema:

\`\`\`
${SCHEMA_REF}
\`\`\`

**Important rules:**
- Generate unique IDs (use "g1", "g2" for grants; "l1", "l2" for loans; "t1", "t2" for tranches)
- All dates must be YYYY-MM-DD format
- Interest rates are decimal (4% = 0.04), NOT percentage
- Vesting tranche shares must sum to totalShares for each grant
- For "purchase" grants: early tranches are typically taxTreatment "none", later ones "capital_gains"
- For "bonus" grants: early tranches "income", later tranches "capital_gains"
- For "free"/"catch_up" grants: usually "income" or "capital_gains"
- You can include only the sections you have data for (grants, loans, or stockPrices)
- If a loan was refinanced, set the old loan status to "refinanced" and give the new loan a refinancedFromId pointing to the old one
- It's OK to leave out optional fields

Here is my raw data. It may come from multiple sources (HR portal, loan statements, etc.):

---
[PASTE YOUR DATA HERE]
---

Please convert this to valid JSON matching the schema above. Include only the data I provided — do not make up values.`;

export function AiImportHelper() {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<'prompt' | 'schema' | null>(null);

  async function copyToClipboard(text: string, which: 'prompt' | 'schema') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback: select the text
    }
  }

  return (
    <section className="card">
      <div
        className="ai-helper-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <h3>Convert Data with AI</h3>
        <span className="ai-helper-toggle">{expanded ? '−' : '+'}</span>
      </div>

      {expanded && (
        <div className="ai-helper-body">
          <p className="note">
            Have stock or loan data in another format (spreadsheet, PDF, email, HR portal)?
            Copy the prompt below, paste it into Claude or ChatGPT along with your raw data,
            and get back valid JSON you can import above.
          </p>

          <div className="ai-helper-section">
            <div className="ai-helper-section-header">
              <strong>Step 1: Copy the conversion prompt</strong>
              <button
                className="btn btn-small btn-primary"
                onClick={() => copyToClipboard(PROMPT_TEMPLATE, 'prompt')}
              >
                {copied === 'prompt' ? 'Copied!' : 'Copy Prompt'}
              </button>
            </div>
            <pre className="ai-helper-code">{PROMPT_TEMPLATE}</pre>
          </div>

          <div className="ai-helper-section">
            <div className="ai-helper-section-header">
              <strong>Step 2: Paste your data</strong>
            </div>
            <p className="note">
              Replace [PASTE YOUR DATA HERE] with your actual data. You can paste data
              from different sources — grant info from HR, loan info from statements,
              stock prices from wherever. The AI will figure out what goes where.
            </p>
          </div>

          <div className="ai-helper-section">
            <div className="ai-helper-section-header">
              <strong>Step 3: Import the result</strong>
            </div>
            <p className="note">
              Copy the JSON that the AI generates, save it as a .json file, and use the
              "Import JSON" button above to load it. The import will merge with any
              existing data.
            </p>
          </div>

          <details className="ai-helper-schema-details">
            <summary>Schema reference</summary>
            <div className="ai-helper-section-header">
              <span></span>
              <button
                className="btn btn-small"
                onClick={() => copyToClipboard(SCHEMA_REF, 'schema')}
              >
                {copied === 'schema' ? 'Copied!' : 'Copy Schema'}
              </button>
            </div>
            <pre className="ai-helper-code">{SCHEMA_REF}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
