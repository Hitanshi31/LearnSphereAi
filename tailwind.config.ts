import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#5d50ee",
        "brand-mark": "#6659f4",
        "brand-light": "#f0efff",
        ink: "#202236",
        sub: "#85889a",
        canvas: "#f8f8fc",
      },
      fontFamily: {
        sans: ["'DM Sans'", "Arial", "sans-serif"],
        serif: ["'Playfair Display'", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
