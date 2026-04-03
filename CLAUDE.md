# CLAUDE.md — fxn-erp-frontend

## Project Overview

Angular v21 ERP frontend application with multi-locale support (French/English), Angular Material UI, and PWA capabilities. Deployed on Vercel.

**Backend:** Node/Express + MongoDB (`exchange-backend`, running on `http://localhost:5000`)

## Development Branch

Default branch: **`dev`**

## Commands

```bash
# Development server (default locale)
npm start

# Development server with specific locale
npm run start:fr   # French
npm run start:en   # English

# Production build
npm run build
npm run build:fr
npm run build:en

# Run unit tests
npm test

# Extract i18n messages
npm run i18n:extract   # if configured
```

## Architecture

```
src/app/
├── core/          # Services, guards, interceptors, models, pipes
├── layout/        # Header, breadcrumbs
├── shared/        # Shared components and utilities
├── modules/
│   ├── auth/      # Authentication, profile
│   ├── admin/     # 18 sub-modules (dashboard, users, orders, interventions, etc.)
│   ├── technician/
│   ├── user/
│   ├── hr/
│   ├── consumable/
│   ├── depot/
│   ├── vehicle/
│   └── dashboard/
src/locale/        # i18n translation files (.xlf), French is source locale
public/            # Static assets (fonts, icons, logos)
```

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Angular 21 |
| Language | TypeScript 5.9 (strict mode) |
| Styling | SCSS |
| UI Library | Angular Material 21 |
| Icons | FontAwesome 7, Bootstrap Icons |
| Testing | Jasmine + Karma (ChromeHeadless) |
| i18n | Angular i18n (fr / en) |
| PWA | Angular Service Worker |
| Formatting | Prettier (printWidth: 100, singleQuote: true) |
| Deployment | Vercel |

## Code Style Rules

- **Preserve the existing design system** — buttons, tokens, layout patterns. Do not restyle components globally.
- **Targeted changes only** — avoid reformatting entire HTML/SCSS files; make minimal, surgical edits.
- **Prettier** is configured in `package.json`: 100-char line width, single quotes, Angular HTML parser.
- **TypeScript strict mode** is enabled — no implicit `any`, strict null checks apply.
- Component naming: `{feature}-{type}.ts` (e.g. `user-list.ts`, `hr-form.ts`).
- Every component should have a corresponding `.spec.ts` test file.

## i18n

- Source locale is **French (`fr`)**.
- Translation files are in `src/locale/` (`.xlf` format).
- Use `$localize` tags or `i18n` attributes on templates for translatable strings.
- Run locale-specific builds with `npm run build:fr` / `npm run build:en`.

## API Proxy

In development, `/api/*` requests are proxied to `http://localhost:5000` via `proxy.conf.json`. The backend must be running locally for API calls to work.

## Testing

```bash
npm test   # Runs Karma with ChromeHeadless, generates coverage report
```

Coverage output goes to `coverage/`. Tests use Jasmine syntax.

## Security

- CSP, HSTS, X-Frame-Options, and other security headers are configured in `vercel.json` for production.
- Do not weaken or remove security headers.
- Avoid introducing XSS vectors (e.g. `innerHTML`, `bypassSecurityTrust*` without justification).

## Workflow Notes

- Keep frontend and backend changes in **separate commits**.
- If a change requires a manual step (reimport data, push to remote, env variable), state it explicitly.
- Do not run destructive DB operations unless explicitly requested.
- Network operations (git push, external API calls) must be explicitly confirmed.
