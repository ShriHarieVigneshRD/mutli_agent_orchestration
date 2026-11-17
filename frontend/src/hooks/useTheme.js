import { useCallback, useState } from 'react';

const current = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

/** Light/dark theme. index.html applies the saved or OS choice before paint; this toggles and saves it. */
export function useTheme() {
  const [theme, setTheme] = useState(current);

  const toggle = useCallback(() => {
    const next = current() === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    // Switch instantly: without this every colour transition in the page animates the theme change.
    root.classList.add('theme-switching');
    root.dataset.theme = next;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
    setTheme(next);
  }, []);

  return { theme, toggle };
}
