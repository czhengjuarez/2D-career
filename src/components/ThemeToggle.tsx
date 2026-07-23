import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

export type Theme = 'light' | 'system' | 'dark';

const STORAGE_KEY = 'of-theme';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function readTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
}

/**
 * Every Keel token is defined with `light-dark(...)`, so switching themes only needs to flip
 * the computed `color-scheme` — never duplicate hex values per mode. The attribute drives a
 * CSS rule rather than an inline style, which is what actually re-resolves `light-dark()`.
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          className="theme-toggle__btn"
          aria-checked={theme === value}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          onClick={() => setTheme(value)}
        >
          <Icon size={15} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
