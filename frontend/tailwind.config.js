/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#ffffff",
          muted: "#f8fafc",
          elevated: "#fdfefc",
        },
        border: {
          subtle: "#e5e7eb",
          soft: "#d6dae2",
        },
        accent: {
          primary: "#2563eb",
          secondary: "#0f172a",
          danger: "#dc2626",
        },
        status: {
          success: {
            DEFAULT: "#16a34a",
            soft: "#ecfdf5",
            border: "#bbf7d0",
            text: "#166534",
          },
          warning: {
            DEFAULT: "#f97316",
            soft: "#fff7ed",
            border: "#fed7aa",
            text: "#9a3412",
          },
          info: {
            DEFAULT: "#0ea5e9",
            soft: "#e0f2fe",
            border: "#bae6fd",
            text: "#0c4a6e",
          },
          danger: {
            DEFAULT: "#dc2626",
            soft: "#fef2f2",
            border: "#fecaca",
            text: "#7f1d1d",
          },
          neutral: {
            DEFAULT: "#475569",
            soft: "#f1f5f9",
            border: "#cbd5f5",
            text: "#1e293b",
          }
        }
      },
      boxShadow: {
        soft: "0 8px 30px rgba(15, 23, 42, 0.08)",
        lift: "0 12px 40px rgba(15, 23, 42, 0.12)",
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.5rem",
        pill: "9999px",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        rotate180: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(180deg)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-in-out forwards",
        rotate180: "rotate180 0.3s ease-in-out forwards",
      },
    },
  },
  plugins: [],
};
