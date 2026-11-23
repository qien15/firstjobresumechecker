# FirstJob Recruiter Workspace

React + TypeScript workspace for recruitment agency employees, with a Cloudflare Worker API and R2 persistence.

## Features

- Agency workspaces and server-enforced Owner, Manager and Recruiter roles
- Email-bound, single-use employee invitation codes valid for 7 days
- Client jobs with must-have and nice-to-have requirements and recruiter assignment
- PDF, DOCX and TXT resume import, editable extracted text, skill detection and candidate records
- Evidence-based candidate comparison, phone screening questions, answers and recruiter confirmations
- Editable client introductions built from recorded details and saved confirmations
- Contact history, follow-up dates, completion tracking and team progress
- Existing one-page resume checker under Resume checker

Documents are parsed in the browser. Saving a candidate stores extracted resume text and reviewed fields in the agency workspace, not the original document. Scanned PDFs require a text-based file or pasted text. Matching and introduction generation use rules and templates.

## Local development

Install Node.js 22+ and run:

```sh
npm ci
npm run dev
```

The printed local URL opens an isolated development workspace with Local Developer identity. Its test data resets when the process restarts. This identity shim lives only in scripts/dev.mjs and is excluded from the production worker.

On Windows PowerShell, use npm.cmd if npm.ps1 is restricted.

```sh
npm run build
npm run test:server
```

## Hosted deployment

The production artifact is dist/server/index.js. scripts/build-worker.mjs embeds the Vite client assets in the Worker. .openai/hosting.json declares the Sites project and BUCKET R2 binding. Sites provides authenticated user headers and provisions the bucket. API handlers reject missing identity and authorize workspace membership and writes server-side.

Create an agency on first use. Invite employees from Team, share each code only with its intended recipient, and grant them access through the private Site's sharing settings. App invitation codes do not grant platform access and do not send email.

Each company is a separate R2 object. Conditional writes and revision checks reject concurrent stale edits. Refresh and retry after a conflict. Owners can manage managers and recruiters. Managers can manage recruiters. Recruiters can read company records and edit candidates and jobs assigned to them. Deactivating a member blocks subsequent API access.

This repository contains application source only. Resume records, invitation secrets and runtime identity are not committed. Production payment processing, email delivery and OCR are outside this implementation.
