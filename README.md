# design-system-generator

[![CI](https://github.com/benmcosker/design-system-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/benmcosker/design-system-generator/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@benjaminmcosker/design-system-generator.svg)](https://www.npmjs.com/package/@benjaminmcosker/design-system-generator)
[![Storybook](https://img.shields.io/badge/Storybook-live%20demo-FF4785?logo=storybook&logoColor=white)](https://main--6a5fc3291d6b2fa47f0cdd53.chromatic.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Design tokens in → accessible React + TypeScript component library out.**

`dsg` takes a JSON/YAML design-token spec and generates a complete, publishable
component library with accessibility built in from the first line — not bolted
on after:

- 🎨 **Token-driven** — one spec file defines colors, typography, spacing, radii, and focus rings; everything is emitted as CSS custom properties.
- ♿ **Accessibility enforced at generation time** — every color pair used by generated components is checked against WCAG AA contrast ratios *before* any code is emitted. An inaccessible palette fails the build with the exact ratios that missed the bar.
- 🧪 **axe-core in CI** — every generated component ships with an axe-core test, and this repo's CI generates the example system and runs those tests on every push.
- 📚 **Auto-generated Storybook** — CSF3 stories for every component, with `@storybook/addon-a11y` set to fail on violations, plus a Chromatic script for visual regression.
- 🤖 **Claude-written docs** — with `--ai-docs`, the Claude API writes each component's usage docs and accessibility notes *from the actual generated source and token spec*, so the docs describe what was really built.
- 📦 **Publishable output** — the generated library is a ready-to-publish npm package; this tool itself releases with semantic-release and conventional commits.

## Quick start

```bash
npm install
npm run build

# Validate a token spec (schema + WCAG AA contrast)
node dist/cli.js check example/tokens.yaml

# Generate a component library
node dist/cli.js generate example/tokens.yaml -o generated-ds

# With Claude-written docs
export ANTHROPIC_API_KEY=sk-ant-...
node dist/cli.js generate example/tokens.yaml -o generated-ds --ai-docs

# Try the output
cd generated-ds
npm install
npm test           # axe-core a11y tests for every component
npm run storybook  # auto-generated docs
```

## The token spec

```yaml
name: acme
colors:
  primary: "#1d4ed8"
  background: "#ffffff"
  surface: "#f8fafc"
  text: "#0f172a"
  textMuted: "#475569"
  danger: "#b91c1c"
  success: "#15803d"
  warning: "#b45309"
typography:
  fontFamily: "'Inter', system-ui, sans-serif"
  baseSizePx: 16
  scale: 1.25
spacing:
  unitPx: 4
```

Only `name` and `colors` are required — everything else has sensible defaults.
Specs are validated with [zod](https://github.com/colinhacks/zod), and readable
"on-colors" (e.g. the label color for a primary button) are computed
automatically from your palette.

### What happens with an inaccessible palette?

Generation refuses to proceed and tells you exactly why:

```
Token spec fails WCAG AA contrast requirements:
  - muted text on background: #cbd5e1 on #ffffff is 1.47:1 (needs 4.5:1)
```

## What gets generated

```
generated-ds/
├── package.json              # publishable, with test/storybook/chromatic scripts
├── .storybook/               # Storybook config with a11y addon (fails on violations)
├── src/
│   ├── tokens.css            # your tokens as CSS custom properties
│   ├── styles.css            # component styles incl. :focus-visible rings
│   ├── index.ts
│   ├── testing/axe.ts        # shared axe-core assertion helper
│   └── Button/
│       ├── Button.tsx        # accessible component (real <button>, aria-busy, …)
│       ├── Button.stories.tsx
│       ├── Button.test.tsx   # axe-core accessibility test
│       └── Button.docs.md    # Claude-written usage docs + a11y notes
│   └── TextField/ Badge/ Alert/ …
```

Components generated today: **Button**, **TextField**, **Badge**, **Alert**,
**Checkbox**, **Switch**, **RadioGroup**, **Select** — each built on real
semantic HTML wherever possible (native checkboxes, radios, and `<select>`)
so keyboard support, labeling, and state come from the browser instead of
hand-rolled ARIA: wired labels, `aria-describedby` plumbing,
severity-appropriate live regions, keyboard-visible focus rings.

## How the accessibility guarantee works

1. **At generation time** — WCAG contrast math (relative luminance per WCAG 2.1)
   runs over every foreground/background pair the components will use: body
   text, muted text, button labels on filled backgrounds, status text, and the
   focus ring against the page. Failures abort generation.
2. **In the generated package** — every component has an axe-core test run in
   jsdom (`npm test`). The `color-contrast` rule is disabled there — jsdom
   doesn't paint pixels — because contrast was already proven from the token
   values in step 1.
3. **In this repo's CI** — the `generated-a11y` job generates the example
   system from scratch and runs its axe-core suite on every push, so "generated
   components pass axe-core" is a tested claim, not a README promise.

## AI-assisted docs

`--ai-docs` sends each component's *actual generated source* plus the validated
token spec to the Claude API (`claude-opus-4-8`, streaming, adaptive thinking)
and writes `<Component>.docs.md` with usage examples, a props table, grounded
accessibility notes, and do/don't guidance. Without the flag (or if the API is
unavailable) a deterministic fallback doc is written instead, so generation
never blocks on the network.

## Development

```bash
npm test           # unit tests: schema, contrast math, generator output
npm run typecheck
npm run dev -- generate example/tokens.yaml -o /tmp/out
```

Releases are automated with semantic-release on `main` using conventional
commits (`feat:`, `fix:`, `feat!:`…).

## License

MIT
