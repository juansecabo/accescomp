import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: {
          700: "#1e3350",
          800: "#16243a",
          900: "#0d1b2a",
        },
        brand: {
          DEFAULT: "#1d63e6",
          hover: "#164ab0",
          disabled: "#9db7e4",
        },
        sidenav: {
          DEFAULT: "#9fb3cd",
          strong: "#e2e8f0",
        },
        page: "#f4f6f8",
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f8fafc",
          muted2: "#fbfcfd",
        },
        line: {
          DEFAULT: "#e3e7ec",
          strong: "#dfe4ea",
          soft: "#eef1f4",
          row: "#f1f4f7",
        },
        control: "#f1f4f7",
        estado: {
          recibido: { DEFAULT: "#1d4ed8", soft: "#eff5ff", solid: "#1d4ed8" },
          proceso: { DEFAULT: "#c2410c", soft: "#fff7ed", solid: "#c2410c" },
          listo: { DEFAULT: "#047857", soft: "#ecfdf5", solid: "#047857" },
          entregado: { DEFAULT: "#475569", soft: "#f1f5f9", solid: "#64748b" },
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Manrope", "Helvetica", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "11px",
        field: "9px",
        chip: "6px",
        modal: "13px",
      },
      boxShadow: {
        menu: "0 12px 24px rgba(15,23,42,.14)",
        modal: "0 24px 60px rgba(15,23,42,.3)",
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shake': 'shake 0.5s ease-in-out',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
