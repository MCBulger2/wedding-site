import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const ThemeStorageKey = 'wedding.theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readThemePreference(),
  );
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    getSystemTheme(),
  );
  const resolvedTheme = resolveThemePreference(preference, systemTheme);

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = (event: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    syncSystemTheme(mediaQuery);
    mediaQuery.addEventListener('change', syncSystemTheme);
    return () => mediaQuery.removeEventListener('change', syncSystemTheme);
  }, []);

  const setPreference = (nextPreference: ThemePreference) => {
    setStoredThemePreference(nextPreference);
    setPreferenceState(nextPreference);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
      toggleTheme: () => {
        setPreference(resolvedTheme === 'dark' ? 'light' : 'dark');
      },
    }),
    [preference, resolvedTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system';
  }

  return parseThemePreference(window.localStorage.getItem(ThemeStorageKey));
}

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system';
}

export function setStoredThemePreference(preference: ThemePreference) {
  if (typeof window === 'undefined') {
    return;
  }

  if (preference === 'system') {
    window.localStorage.removeItem(ThemeStorageKey);
    return;
  }

  window.localStorage.setItem(ThemeStorageKey, preference);
}

export function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference;
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
