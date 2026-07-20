import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color like #2563eb');

/**
 * The design-token spec a user hands to the generator (JSON or YAML).
 * Everything optional has a sensible default so a minimal spec still
 * produces a complete design system.
 */
const colorsSchema = z.object({
  primary: hexColor,
  background: hexColor,
  surface: hexColor,
  text: hexColor,
  textMuted: hexColor,
  danger: hexColor,
  success: hexColor,
  warning: hexColor,
});

export const tokenSpecSchema = z.object({
  /** Machine name for the generated package, e.g. "acme" -> acme-design-system */
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'must be lowercase kebab-case'),
  colors: colorsSchema,
  /**
   * Optional dark-theme palette, same shape as `colors`. When present, the
   * generator validates it against WCAG AA independently and emits it as a
   * `[data-theme="dark"]` / `prefers-color-scheme: dark` CSS override.
   */
  darkColors: colorsSchema.optional(),
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

/**
 * Token spec plus values the generator computes: readable foreground
 * colors for each filled surface, and the resolved focus-ring color.
 */
export interface ThemeComputed {
  onPrimary: string;
  onDanger: string;
  onSuccess: string;
  onWarning: string;
  focusRingColor: string;
}

export interface ResolvedTokens extends TokenSpec {
  computed: ThemeComputed & {
    /** Present only when the spec provides `darkColors`. */
    dark?: ThemeComputed;
  };
}
