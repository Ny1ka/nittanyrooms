import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
export type ThemePref = Theme | 'auto';

const KEY = 'nr-theme';
const mq = () => window.matchMedia('(prefers-color-scheme: light)');
const readPref = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'auto' ? v : 'dark'; // dark is the default
  } catch {
    return 'dark';
  }
};
const resolve = (p: ThemePref): Theme => (p === 'auto' ? (mq().matches ? 'light' : 'dark') : p);

/** Appearance preference (Light / Dark / Auto). Stored per browser as a convenience. */
export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readPref);
  useEffect(() => {
    const apply = () => {
      const t = resolve(pref);
      document.documentElement.dataset.theme = t;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0B0D10' : '#F6F7F9');
      window.dispatchEvent(new CustomEvent('nr:theme', { detail: t }));
    };
    apply();
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* storage blocked */
    }
    if (pref !== 'auto') return;
    const m = mq();
    m.addEventListener('change', apply);
    return () => m.removeEventListener('change', apply);
  }, [pref]);
  return [pref, setPref];
}

/** Resolved theme, for consumers outside React state (the map). */
export function useThemeValue(): Theme {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  useEffect(() => {
    const on = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener('nr:theme', on);
    return () => window.removeEventListener('nr:theme', on);
  }, []);
  return theme;
}
