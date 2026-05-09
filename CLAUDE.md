# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MediaWiki gadget management for elaina.miraheze.org. Manages custom CSS/JS (gadgets and global styles) via a build pipeline that transpiles TypeScript, minifies CSS, and deploys to the wiki using a bot account through the MediaWiki API.

## Commands

```bash
pnpm run build     # Build: transpile TS→JS (SWC, ES5/CJS), minify CSS (LightningCSS), output to dist/
pnpm run deploy    # Build + deploy to wiki via MediaWiki API (requires .env credentials)
pnpm run fmt       # Format code with oxfmt
pnpm run lint:dev  # Lint scripts/ directory with ESLint
```

Deployment runs automatically via GitHub Actions on push to `main` touching `src/`.

## Directory Structure

```
scripts/              # Build & deploy toolchain (TypeScript, Node.js)
  run.ts              # CLI entry: --mode=build | --mode=deploy
  build/
    build.ts          # Transpile JS/TS (SWC) + minify CSS (LightningCSS), wrap in <nowiki>
    definition.ts     # Parse gadget definition YAMLs → generate MediaWiki:Gadgets-definition
  deploy/
    deploy.ts         # mwn bot: push dist/ files to wiki, update MediaWiki:Deployment.json
    utils.ts          # SHA-256 content hashing for incremental deployment
  types/              # Shared TypeScript type definitions (gadgets.d.ts, deploy.d.ts)

src/                  # Source code
  gadgets/            # Individual gadget directories
    {GadgetName}/
      definition.yaml # Gadget metadata (RL, rights, deps, files list, enabled flag)
      Gadget-*.js|ts  # Gadget source code
      Gadget-*.css    # Gadget stylesheets
    Gadgets-definition-list.yaml  # Section ordering for the gadget definition page
  global/             # Site-wide CSS/JS (Common.css, Citizen.css, group-specific styles)
  types/              # Type augmentations (mediawiki.d.ts imports types-mediawiki)

dist/                 # Build output (generated, not committed)
.github/workflows/    # CI: GitHub Actions deploy workflow
```

## Key Architecture

- **Gadgets**: Each gadget lives in `src/gadgets/{Name}/` with a `definition.yaml` configuring ResourceLoader settings (rights, dependencies, skins, type) plus an `enable` flag and `files` list. Source files follow the `Gadget-*` naming convention.
- **Build pipeline**: Reads all gadget definitions, resolves enabled gadgets, generates the `MediaWiki:Gadgets-definition` page content. Transpiles TS→ES5/CommonJS via SWC (for MediaWiki compatibility), minifies CSS via LightningCSS. All output is wrapped in `/* <nowiki> */` blocks per MediaWiki convention.
- **Deploy**: Uses `mwn` bot to push `dist/` files to the wiki. Tracks deployed state in `MediaWiki:Deployment.json` (SHA-256 hashes) for incremental updates — only changed files are re-uploaded.
- **Config files**: `.env` holds bot credentials (USERAGENT, PASSWORD). `.swcrc` sets target=es5, module=commonjs for MediaWiki compatibility.
- **Global styles**: `src/global/` contains site-wide CSS (Common.css, Citizen.css theme) and group-specific styles (interface-admin, sysop, patroller).
