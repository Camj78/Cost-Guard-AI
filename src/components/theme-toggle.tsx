"use client";
import { useTheme } from "next-themes";
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const current = theme === "system" ? resolvedTheme : theme;
  return (
    <button onClick={() => setTheme(current === "dark" ? "light" : "dark")}>
      {current === "dark" ? "Light" : "Dark"}
    </button>
  );
}
