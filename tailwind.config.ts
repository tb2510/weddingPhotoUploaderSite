import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#FAF7F1",
        wine: {
          DEFAULT: "#8C3A46",
          dark: "#6E2C36",
          light: "#B5495B",
        },
        sage: "#7C8B6F",
        ink: "#2B2620",
        stone: "#8A8177",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
