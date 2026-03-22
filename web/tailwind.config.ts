import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Dark theme tokens — Railway-style dark navy
        surface: "#13141A",
        panel: "#191B24",
        card: "#1E2028",
        lift: "#252730",
        "muted-bg": "#2E3040",
        hi: "#E8EAF0",
        md: "#9BA3B4",
        lo: "#5C6375",
        accent: "#7C5CFF",
        success: "#22C55E",
      },
    },
  },
  plugins: [],
};
export default config;
