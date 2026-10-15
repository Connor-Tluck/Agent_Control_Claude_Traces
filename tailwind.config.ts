import type { Config } from 'tailwindcss'

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        border: token('border'),
        'border-strong': token('border-strong'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        surface: token('surface'),
        raised: token('raised'),
        subtle: token('subtle'),
        brand: {
          DEFAULT: token('brand'),
          soft: token('brand-soft'),
        },
        success: token('success'),
        danger: token('danger'),
        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('accent-foreground'),
        },
        editor: {
          DEFAULT: token('editor-bg'),
          gutter: token('editor-gutter'),
          'gutter-active': token('editor-gutter-active'),
          line: token('editor-line'),
        },
        trace: {
          code: token('trace-code'),
          runner: token('trace-runner'),
          request: token('trace-request'),
          'request-border': token('trace-request-border'),
          tool: token('trace-tool'),
          model: token('trace-model'),
          control: token('trace-control'),
          grid: token('trace-grid'),
          stripe: token('trace-stripe'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        composer: '0 1px 2px hsl(240 10% 4% / 0.04), 0 8px 24px -12px hsl(240 10% 4% / 0.12)',
      },
    },
  },
  plugins: [],
}

export default config
