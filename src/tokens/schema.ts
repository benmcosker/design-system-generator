import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color like #2563eb');

/**
 * The design-token spec a user hands to the generator (JSON or YAML).
 * Everything optional has a sensible default so a minimal spec still
 * produces a complete design system.
 */
export const tokenSpecSchema = z.object({
  /** Machine name for the generated package, e.g. "acme" -> acme-design-system */
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'must be lowercase kebab-case'),
  colors: z.object({
    primary: hexColor,
    background: hexColor,
    surface: hexColor,
    text: hexColor,
    textMuted: hexColor,
    danger: hexColor,
    success: hexColor,
    warning: hexColor,
    // Optional palette slots used by the shadcn target. Each defaults from
    // the colors above in resolveTokens(), so existing specs are unaffected.
    secondary: hexColor.optional(),
    accent: hexColor.optional(),
    muted: hexColor.optional(),
    border: hexColor.optional(),
    input: hexColor.optional(),
    chart: z.array(hexColor).min(1).max(5).optional(),
    // Optional label-color overrides. When set they replace bestTextOn() and
    // are contrast-checked against the same fill.
    onPrimary: hexColor.optional(),
    onDanger: hexColor.optional(),
    onSuccess: hexColor.optional(),
    onWarning: hexColor.optional(),
    onSecondary: hexColor.optional(),
    onAccent: hexColor.optional(),
  }),
  typography: z
    .object({
      fontFamily: z
        .string()
        .default("system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"),
      baseSizePx: z.number().int().min(12).default(16),
      scale: z.number().min(1).max(2).default(1.25),
    })
    .default({}),
  spacing: z
    .object({
      unitPx: z.number().int().min(1).default(4),
    })
    .default({}),
  radius: z
    .object({
      sm: z.string().default('4px'),
      md: z.string().default('8px'),
      lg: z.string().default('16px'),
    })
    .default({}),
  focus: z
    .object({
      ringWidthPx: z.number().int().min(2).default(3),
      /** Defaults to colors.primary when omitted */
      ringColor: hexColor.optional(),
    })
    .default({}),
});

export type TokenSpec = z.infer<typeof tokenSpecSchema>;

/** Which output `dsg generate` produces; it also selects the contrast pairs checked. */
export type Target = 'react' | 'shadcn';

/**
 * Token spec plus values the generator computes: readable foreground
 * colors for each filled surface, and the resolved focus-ring color.
 */
export interface ResolvedTokens extends TokenSpec {
  computed: {
    onPrimary: string;
    onDanger: string;
    onSuccess: string;
    onWarning: string;
    focusRingColor: string;
    onSecondary: string;
    onAccent: string;
    onMuted: string;
    /** Optional palette slots, resolved to their defaults when not set. */
    secondary: string;
    accent: string;
    muted: string;
    border: string;
    input: string;
    chart: string[];
  };
}
