import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: {
    brand: { 50:"#eefaff",100:"#d8f3ff",200:"#b9eaff",300:"#89deff",400:"#51c9fc",500:"#29adf2",600:"#1d8ed3",700:"#1b72ab",800:"#1c608d",900:"#1c4f74" },
    ink: { 900:"#0b1b2b", 700:"#26394d", 500:"#5b6f84", 300:"#c5d0db", 100:"#eef2f6", 50:"#f6f8fb" } },
    boxShadow: { card: "0 1px 2px rgba(11,27,43,.05), 0 8px 24px -12px rgba(11,27,43,.12)" } } },
  plugins: [],
} satisfies Config;
