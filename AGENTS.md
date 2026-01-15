## Scope
- Workspace root: /home/coulibaly/Bureau/erp
- Frontend: /home/coulibaly/Bureau/erp/fxn-erp-frontend (Angular)
- Backend: /home/coulibaly/Bureau/erp/exchange-backend (Node/Express + Mongo)

## Frontend rules
- Default branch: dev
- UI edits should preserve the existing design system (buttons, tokens, layout)
- Prefer small, targeted HTML/SCSS changes; avoid reformatting whole files

## Backend rules
- Default branch: cod
- Keep import logic deterministic and merge-friendly (no data loss on duplicates)
- Avoid destructive DB operations unless explicitly requested

## Workflow
- Keep frontend and backend changes separate (distinct commits per repo)
- Summarize changes and note any manual steps (reimport, push, etc.)
- If network access is required (push, external API), state it clearly
