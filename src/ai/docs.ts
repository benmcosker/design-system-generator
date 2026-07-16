import Anthropic from '@anthropic-ai/sdk';
import type { ResolvedTokens } from '../tokens/schema.js';

const MODEL = 'claude-opus-4-8';

const SYSTEM = `You are a senior design-system engineer writing documentation for a generated React + TypeScript component library.

Write concise, practical markdown documentation for one component at a time. Structure:

# <ComponentName>

One-paragraph summary of what the component is for.

## Usage

A short realistic JSX example (fenced tsx code block).

## Props

A markdown table of props with types, defaults, and descriptions — derived from the component source you are given.

## Accessibility

Concrete notes grounded in the actual implementation: which ARIA attributes it sets and why, keyboard behavior, focus handling, and how the design tokens guarantee contrast. Do not invent behavior that is not in the source.

## Do / Don't

3-4 short bullet pairs of good and bad usage.

Output only the markdown document — no preamble.`;

export interface DocsInput {
  name: string;
  source: string;
}

/**
 * Generate usage docs and accessibility notes for a component with the
 * Claude API. The token spec and the real component source are both given
 * to the model so the docs describe what was actually generated.
 */
export async function generateAiDocs(
  component: DocsInput,
  tokens: ResolvedTokens,
  client: Anthropic = new Anthropic(),
): Promise<string> {
  const prompt = [
    `Design token spec (already validated for WCAG AA contrast at generation time):`,
    '```json',
    JSON.stringify(tokens, null, 2),
    '```',
    '',
    `Component source (\`${component.name}.tsx\`):`,
    '```tsx',
    component.source,
    '```',
    '',
    `Write the documentation for ${component.name}.`,
  ].join('\n');

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const message = await stream.finalMessage();
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/** Deterministic fallback used when AI docs are disabled or unavailable. */
export function fallbackDocs(component: DocsInput, tokens: ResolvedTokens): string {
  return `# ${component.name}

Part of the ${tokens.name} design system. Generated from design tokens with
WCAG AA contrast verified at generation time.

## Usage

\`\`\`tsx
import { ${component.name} } from '${tokens.name}-design-system';
\`\`\`

## Accessibility

This component ships with an axe-core test (\`${component.name}.test.tsx\`).
See the component source for the ARIA attributes it manages.

> Tip: re-run the generator with \`--ai-docs\` (requires \`ANTHROPIC_API_KEY\`)
> to replace this file with Claude-written usage docs and a11y notes.
`;
}
