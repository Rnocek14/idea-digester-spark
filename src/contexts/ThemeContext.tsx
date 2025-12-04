import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "lg-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setThemeState] = useState<Theme>("light");

  // Get resolved theme based on system preference
  const getResolvedTheme = (t: Theme): "light" | "dark" => {
    if (t === "system") {
      if (typeof window !== "undefined") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      return "light";
    }
    return t;
  };

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Load theme from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initialTheme = stored || "light";
    setThemeState(initialTheme);
    setResolvedTheme(getResolvedTheme(initialTheme));
    setMounted(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;
    
    const resolved = getResolvedTheme(theme);
    setResolvedTheme(resolved);
    
    const root = document.documentElement;
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, mounted]);

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted || theme !== "system") return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? "dark" : "light");
      const root = document.documentElement;
      if (e.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };
    
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  // Provide safe defaults before mount
  const value: ThemeContextType = {
    theme: mounted ? theme : "light",
    setTheme,
    resolvedTheme: mounted ? resolvedTheme : "light",
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: "light" as Theme,
      setTheme: () => {},
      resolvedTheme: "light" as const,
    };
  }
  return context;
}
