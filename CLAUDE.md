# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start local Amplify backend (must run before dev server on first setup)
npx ampx sandbox

# Start development server
npm run dev

# Production build (TypeScript check + Vite bundle)
npm run build

# Preview production build locally
npm run preview

# Lint
npm run lint

# Format source files
npm run format
```

There are no test scripts defined in this project.

## Architecture

This is an **AWS Amplify Gen 2 + React 19 + Vite + TypeScript** sample that demonstrates secure S3 file browsing with Cognito authentication.

### Data flow

1. `npx ampx sandbox` provisions the AWS backend and generates `amplify_outputs.json`
2. `src/main.tsx` bootstraps React and renders `<App />`
3. `src/App.tsx` imports `amplify_outputs.json` and calls `Amplify.configure(config)` to wire up the SDK
4. The `<Authenticator>` component (Cognito, email-only, sign-up disabled) gates the app
5. `createStorageBrowser()` + `createAmplifyAuthAdapter()` produce the S3 browser UI component

### Backend (`amplify/`)

| File | Purpose |
|------|---------|
| `amplify/backend.ts` | Top-level CDK stack — wires auth, storage, IAM policies |
| `amplify/auth/resource.ts` | Cognito user pool config (email login, admin group) |
| `amplify/storage/resource.ts` | No Amplify-managed storage — existing bucket used instead |

The backend references an **existing** S3 bucket (`amplify-custom-config-storage`, eu-west-2) via `Bucket.fromBucketAttributes`. No `defineStorage` is used — the bucket is wired directly into `amplify_outputs.json` via `backend.addOutput`. IAM policies restrict access to the `oyetunji/*` and `kelvin/*` prefixes.

### Frontend (`src/`)

Minimal — only three source files:

- `src/main.tsx` — React root
- `src/App.tsx` — Authenticator wrapper + `<StorageBrowser>` component
- `src/App.css` — Application styles

### Key generated file

`amplify_outputs.json` is gitignored. It contains Cognito pool IDs, S3 bucket names, and AWS region info. A working copy is maintained locally — do not overwrite it without pulling fresh values from the deployed Amplify stack.

**Important:** `Amplify.configure()` throws if two buckets share the same `name` in `amplify_outputs.json`. Always ensure bucket names are unique.

## Local development

`npm run build` (tsc step) tends to hang in some environments. Use Vite directly to bypass tsc:

```bash
node_modules/.bin/vite build
```

The `amplify_outputs.json` must be valid before `npm run dev` will work — an incomplete file (e.g. `{"version":"1.3"}` only) causes Amplify SDK to crash on startup and Vite to hang silently without binding to a port.

## EC2 Deployment

**Server:** `18.235.84.239` (Elastic IP)
**User:** `ubuntu`
**PEM:** `~/DevProjects/Aknight/Cloudplexo/checkit/check-it-2026.pem`
**Source on server:** `/home/ubuntu/gt-pension-src/`
**Served from:** `/home/ubuntu/gt-pension/dist/`
**Live URL:** https://gt-pension.cloudplexo.net
**Nginx config:** `/etc/nginx/sites-available/gt-pension`
**SSL:** Let's Encrypt via Certbot (auto-renews)

### Deploy steps

```bash
# 1. Sync source to server (run from project root)
rsync -avz \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude 'dist.zip' \
  -e "ssh -i ~/DevProjects/Aknight/Cloudplexo/checkit/check-it-2026.pem" \
  ./ ubuntu@18.235.84.239:/home/ubuntu/gt-pension-src/

# 2. Build on server and copy to served directory
ssh -i ~/DevProjects/Aknight/Cloudplexo/checkit/check-it-2026.pem ubuntu@18.235.84.239 '
  source ~/.nvm/nvm.sh &&
  cd /home/ubuntu/gt-pension-src &&
  npm install &&
  node_modules/.bin/vite build &&
  cp -r dist/* /home/ubuntu/gt-pension/dist/ &&
  chmod -R 755 /home/ubuntu/gt-pension
'

# 3. Verify
curl -s https://gt-pension.cloudplexo.net | head -5
```

### Other apps on this server

| App | Domain | Port |
|-----|--------|------|
| gt-pension | gt-pension.cloudplexo.net | nginx static |
| audittar-frontend | audittar.cloudplexo.net | 3001 (PM2) |
| checkit-frontend | checkit.cloudplexo.net | 4173 (PM2) |
| checkit-backend | checkit-api.cloudplexo.net | 3000 (PM2) |

## AWS profile

- **Profile name:** `sylvester-CloudPlexo`
- **Account:** `276023487603` (development-poc)
- **Region:** `eu-west-2`
- **Amplify App ID:** `d1kaxsu6oemmmy`

## Code style

- Prettier config: single quotes, semicolons, 2-space indent, 100-char line width, ES5 trailing commas
- ESLint uses the flat config format (`eslint.config.js`) with TypeScript + React Hooks + React Refresh plugins
- TypeScript strict mode is enabled (`tsconfig.app.json`)
