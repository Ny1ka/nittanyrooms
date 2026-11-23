import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const read = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

/** Dark is the default. The choice is stored per browser (a convenience only). */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0A1628' : '#F5F7FA');
    try {
      localStorage.setItem('nr-theme', theme);
    } catch {
      /* storage blocked; theme still applies for this visit */
    }
    window.dispatchEvent(new CustomEvent('nr:theme', { detail: theme }));
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

/** Subscribe to theme changes from outside React state (e.g. the map). */
export function useThemeValue(): Theme {
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    const on = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener('nr:theme', on);
    return () => window.removeEventListener('nr:theme', on);
  }, []);
  return theme;
}
