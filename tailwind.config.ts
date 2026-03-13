import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        logo: ['Unbounded', 'system-ui', 'sans-serif'],
        display: ['Unbounded', 'system-ui', 'sans-serif'],
        ui: ['Instrument Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: "hsl(var(--primary-50))",
          100: "hsl(var(--primary-100))",
          200: "hsl(var(--primary-200))",
          300: "hsl(var(--primary-300))",
          400: "hsl(var(--primary-400))",
          500: "hsl(var(--primary-500))",
          600: "hsl(var(--primary-600))",
          700: "hsl(var(--primary-700))",
          800: "hsl(var(--primary-800))",
          900: "hsl(var(--primary-900))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          surface: "hsl(var(--success-surface))",
          border: "hsl(var(--success-border))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          surface: "hsl(var(--warning-surface))",
          border: "hsl(var(--warning-border))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          surface: "hsl(var(--info-surface))",
          border: "hsl(var(--info-border))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          surface: "hsl(var(--error-surface))",
          border: "hsl(var(--error-border))",
        },
        status: {
          planned: {
            DEFAULT: "hsl(var(--status-planned))",
            foreground: "hsl(var(--status-planned-foreground))",
            bg: "hsl(var(--status-planned-bg))",
            border: "hsl(var(--status-planned-border))",
          },
          "in-progress": {
            DEFAULT: "hsl(var(--status-in-progress))",
            foreground: "hsl(var(--status-in-progress-foreground))",
            bg: "hsl(var(--status-in-progress-bg))",
            border: "hsl(var(--status-in-progress-border))",
          },
          "on-hold": {
            DEFAULT: "hsl(var(--status-on-hold))",
            foreground: "hsl(var(--status-on-hold-foreground))",
            bg: "hsl(var(--status-on-hold-bg))",
            border: "hsl(var(--status-on-hold-border))",
          },
          completed: {
            DEFAULT: "hsl(var(--status-completed))",
            foreground: "hsl(var(--status-completed-foreground))",
            bg: "hsl(var(--status-completed-bg))",
            border: "hsl(var(--status-completed-border))",
          },
          cancelled: {
            DEFAULT: "hsl(var(--status-cancelled))",
            foreground: "hsl(var(--status-cancelled-foreground))",
            bg: "hsl(var(--status-cancelled-bg))",
            border: "hsl(var(--status-cancelled-border))",
          },
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Rhosonics Custom Colors
        rho: {
          green: "hsl(var(--rho-green))",
          "green-accent": "hsl(var(--rho-green-accent))",
          "green-glow": "hsl(var(--rho-green-glow))",
          obsidian: "hsl(var(--rho-obsidian))",
        },
        // Legacy aliases
        rhosonics: {
          green: "hsl(var(--rho-green))",
          "green-light": "hsl(var(--rho-green-accent))",
          "green-glow": "hsl(var(--rho-green-glow))",
        },
        lime: {
          DEFAULT: "hsl(var(--rho-green-accent))",
          light: "hsl(var(--lime-accent-light))",
        },
        obsidian: {
          DEFAULT: "hsl(var(--rho-obsidian))",
          light: "hsl(var(--rho-obsidian-light))",
        },
        eco: {
          surface: "hsl(var(--eco-surface))",
          "surface-hover": "hsl(var(--eco-surface-hover))",
          border: "hsl(var(--eco-border))",
        },
        mineral: {
          neutral: "hsl(var(--mineral-neutral))",
          surface: "hsl(var(--mineral-surface))",
          deep: "hsl(var(--mineral-deep))",
          bronze: "hsl(var(--mineral-bronze))",
        },
        slate: {
          50: "hsl(var(--slate-50))",
          100: "hsl(var(--slate-100))",
          200: "hsl(var(--slate-200))",
          300: "hsl(var(--slate-300))",
          400: "hsl(var(--slate-400))",
          500: "hsl(var(--slate-500))",
          600: "hsl(var(--slate-600))",
          700: "hsl(var(--slate-700))",
          800: "hsl(var(--slate-800))",
          900: "hsl(var(--slate-900))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "xs": "var(--shadow-xs)",
        "card": "var(--shadow-sm)",
        "card-hover": "var(--shadow-md)",
        "elevated": "var(--shadow-lg)",
        "prominent": "var(--shadow-xl)",
        "glow": "var(--shadow-glow)",
        "glow-sm": "var(--shadow-glow-sm)",
        "glow-lg": "var(--shadow-glow-lg)",
        "mineral": "var(--shadow-mineral)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "page-enter": {
          from: { opacity: "0", transform: "scale(0.995)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "scale-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.95)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 10px hsl(var(--primary) / 0.2)" },
          "50%": { boxShadow: "0 0 20px hsl(var(--primary) / 0.4)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "boot-sequence": {
          "0%": { opacity: "0", transform: "scale(0.8) rotate(-5deg)" },
          "50%": { opacity: "1", transform: "scale(1.05) rotate(2deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "page-enter": "page-enter 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "fade-out": "fade-out 0.3s ease-out forwards",
        "slide-up": "slide-up 0.3s ease-out forwards",
        "slide-down": "slide-down 0.3s ease-out forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        "slide-in-left": "slide-in-left 0.3s ease-out forwards",
        "scale-in": "scale-in 0.2s ease-out forwards",
        "scale-out": "scale-out 0.2s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "spin-slow": "spin-slow 3s linear infinite",
        "boot": "boot-sequence 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
      transitionDuration: {
        "quick": "150ms",
        "normal": "200ms",
        "standard": "300ms",
        "emphasis": "500ms",
      },
      transitionTimingFunction: {
        "out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
