// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './components/SiteLayout.js';
import {
  ThemeProvider,
  ThemeStorageKey,
  parseThemePreference,
  readThemePreference,
  resolveThemePreference,
  useTheme,
} from './theme.js';

type MediaQueryListener = (event: MediaQueryListEvent) => void;

let prefersDark = false;
let mediaQueryListeners = new Set<MediaQueryListener>();

function installMatchMedia(initialPrefersDark: boolean) {
  prefersDark = initialPrefersDark;
  mediaQueryListeners = new Set();

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: prefersDark,
      media: query,
      onchange: null,
      addEventListener: (eventName: string, listener: MediaQueryListener) => {
        if (eventName === 'change') {
          mediaQueryListeners.add(listener);
        }
      },
      removeEventListener: (
        eventName: string,
        listener: MediaQueryListener,
      ) => {
        if (eventName === 'change') {
          mediaQueryListeners.delete(listener);
        }
      },
      addListener: (listener: MediaQueryListener) => {
        mediaQueryListeners.add(listener);
      },
      removeListener: (listener: MediaQueryListener) => {
        mediaQueryListeners.delete(listener);
      },
      dispatchEvent: () => true,
    })),
  });
}

function emitSystemThemeChange(nextPrefersDark: boolean) {
  prefersDark = nextPrefersDark;
  const event = {
    matches: nextPrefersDark,
    media: '(prefers-color-scheme: dark)',
  } as MediaQueryListEvent;

  for (const listener of mediaQueryListeners) {
    listener(event);
  }
}

function ThemeProbe() {
  const { preference, resolvedTheme, toggleTheme } = useTheme();

  return (
    <button type="button" onClick={toggleTheme}>
      {preference}:{resolvedTheme}
    </button>
  );
}

describe('theme preferences', () => {
  beforeEach(() => {
    installMatchMedia(false);
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses and resolves theme preferences safely', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference('unexpected')).toBe('system');
    expect(resolveThemePreference('system', 'dark')).toBe('dark');
    expect(resolveThemePreference('light', 'dark')).toBe('light');
  });

  it('ignores malformed stored preferences', () => {
    window.localStorage.setItem(ThemeStorageKey, 'blue');

    expect(readThemePreference()).toBe('system');
  });

  it('uses system preference until the visitor chooses a theme', async () => {
    installMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(screen.getByRole('button').textContent).toBe('system:light');
    });

    emitSystemThemeChange(true);
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(screen.getByRole('button').textContent).toBe('system:dark');
    });

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(window.localStorage.getItem(ThemeStorageKey)).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(screen.getByRole('button').textContent).toBe('light:light');
    });

    emitSystemThemeChange(true);
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(screen.getByRole('button').textContent).toBe('light:light');
    });
  });

  it('toggles from the header with an accessible label', async () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );

    const toggle = await screen.findByRole('button', {
      name: 'Switch to dark mode',
    });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(window.localStorage.getItem(ThemeStorageKey)).toBe('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(
        screen.getByRole('button', { name: 'Switch to light mode' }),
      ).not.toBeNull();
    });
  });
});
