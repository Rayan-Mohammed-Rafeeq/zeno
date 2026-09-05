import { useEffect } from 'react';

/**
 * Forces the `dark` class on <html> for the lifetime of the component
 * that calls it (public/auth pages).
 *
 * On cleanup it restores whatever theme the user had stored so that
 * navigating into the authenticated app picks up the right theme before
 * ThemeProvider mounts.
 */
export function useForceDark() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add('dark');

    return () => {
      // Restore stored preference so the protected ThemeProvider
      // starts with the right class on the first render.
      const saved = localStorage.getItem('theme') || 'system';
      root.classList.remove('light', 'dark');
      if (saved === 'dark') {
        root.classList.add('dark');
      } else if (saved === 'light') {
        root.classList.add('light');
      } else {
        root.classList.add(
          window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        );
      }
    };
  }, []);
}
