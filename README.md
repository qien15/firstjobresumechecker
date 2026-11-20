# FirstJob Resume Checker

A React + TypeScript web app for students comparing an English resume with an internship or entry-level job description.

## Run locally

Install Node.js, open a terminal in this folder, then run:

```sh
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd install` and `npm.cmd run dev` if script execution is restricted. Open the Local URL printed by Vite.

## Build

```sh
npm run build
```

## Features

- Job description and plain-text resume inputs
- IT skill detection and aliases
- Editable requirements
- Matching resume evidence and three result statuses
- Improvement suggestions, copy controls, and rechecking after edits
- Sample SQL, Git, and React workflow
- Responsive desktop and mobile layout

Checks use keyword and text rules. Resume content is processed in the browser without storage or upload and is cleared on reload.
