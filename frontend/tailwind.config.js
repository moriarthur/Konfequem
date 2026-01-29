/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutral zinc-based palette - professional & clean
        surface: {
          base: "#ffffff",
          muted: "#f4f4f5",
          elevated: "#fafafa",
        },
        border: {
          subtle: "#e4e4e7",
          soft: "#d4d4d8",
        },
        accent: {
          primary: "#3f3f46",
          secondary: "#18181b",
          danger: "#dc2626",
        },
        // Flat status colors - no gradients
        status: {
          success: {
            DEFAULT: "#16a34a",
            soft: "#f0fdf4",
            border: "#bbf7d0",
            text: "#166534",
          },
          warning: {
            DEFAULT: "#f59e0b",
            soft: "#fffbeb",
            border: "#fde68a",
            text: "#92400e",
          },
          info: {
            DEFAULT: "#3b82f6",
            soft: "#eff6ff",
            border: "#bfdbfe",
            text: "#1e40af",
          },
          danger: {
            DEFAULT: "#ef4444",
            soft: "#fef2f2",
            border: "#fecaca",
            text: "#991b1b",
          },
          neutral: {
            DEFAULT: "#71717a",
            soft: "#f4f4f5",
            border: "#e4e4e7",
            text: "#3f3f46",
          }
        }
      },
      // System font stack - fast and native
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      // Professional rounded corners
      borderRadius: {
        "xl": "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
        pill: "9999px",
      },
      // Subtle shadows only - no colored shadows
      boxShadow: {
        soft: "0 1px 3px rgba(0,0,0,0.08)",
        lift: "0 4px 12px rgba(0,0,0,0.10)",
      },
      // Minimal animations
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease-out forwards",
      },
    },
  },
  plugins: [],
};
