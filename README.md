# Three.js Vite Template with TypeScript

Three.js + Vite + TypeScript starter

---

![screenshot](docs/preview.png)

---

## ⚡ Quick Cloning Command

From [Community Notes - Getting Started | Vite](https://vite.dev/guide/#community-templates)

```bash
npx degit Made-of-Clay/vite-threejs-ts-template my-project
cd my-project
# my version of project init deviates this way
pnpm i
pnpm dev
```

## Tech Stack

- Three.js
- TypeScript
- Vite


## CLI Commands

Installation

```bash
pnpm i
```

Run dev mode

```bash
pnpm dev
```

Build

```bash
pnpm build
```

Run build

```bash
pnpm preview
```

## CICD Setup

Ensure your GitHub repo exists before starting.

### Firebase

Firebase is my current static hosting provider.

- Create a site under the playground project.
- run `firebase-tools init hosting:github` and follow the prompts
  - might run `npm config get prefix` to find the bin if PATH isn't configured correctly
- Ensure firebase.json `hosting.site` is entered correctly

### GitHub Actions

- Ensure project builds without error/lint (this breaks/stops builds).
- Push files to remote and what actions for a successful build/deployment.
