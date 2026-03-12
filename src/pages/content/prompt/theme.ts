export type PromptManagerTheme = 'light' | 'dark';

const THEME_ATTRS = ['data-theme', 'data-color-scheme'] as const;

type PromptThemeMediaQuery = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

function getElementTheme(element: Element | null): PromptManagerTheme | null {
  if (!element) return null;

  if (element.classList.contains('dark') || element.classList.contains('dark-theme')) {
    return 'dark';
  }

  if (element.classList.contains('light') || element.classList.contains('light-theme')) {
    return 'light';
  }

  for (const attr of THEME_ATTRS) {
    const value = element.getAttribute(attr);
    if (value === 'dark' || value === 'light') {
      return value;
    }
  }

  return null;
}

export function getPromptManagerTheme(doc: Document = document): PromptManagerTheme {
  const view = doc.defaultView;
  const candidates = [
    doc.querySelector('.theme-host'),
    doc.documentElement,
    doc.body,
  ].filter((element): element is Element => element instanceof Element);

  for (const candidate of candidates) {
    const theme = getElementTheme(candidate);
    if (theme) {
      return theme;
    }
  }

  if (view && typeof view.matchMedia === 'function') {
    return view.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

export function applyPromptManagerTheme(
  panel: HTMLElement,
  doc: Document = document,
): PromptManagerTheme {
  const theme = getPromptManagerTheme(doc);
  panel.classList.toggle('gv-pm-theme-light', theme === 'light');
  panel.classList.toggle('gv-pm-theme-dark', theme === 'dark');
  return theme;
}

export function watchPromptManagerTheme(
  panel: HTMLElement,
  doc: Document = document,
): () => void {
  const view = doc.defaultView;
  const syncTheme = () => {
    applyPromptManagerTheme(panel, doc);
  };

  syncTheme();

  const observer = new MutationObserver(syncTheme);
  const observedElements = [
    doc.querySelector('.theme-host'),
    doc.documentElement,
    doc.body,
  ].filter((element): element is Element => element instanceof Element);

  for (const element of observedElements) {
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['class', ...THEME_ATTRS],
    });
  }

  const mediaQuery =
    view && typeof view.matchMedia === 'function'
      ? (view.matchMedia('(prefers-color-scheme: dark)') as PromptThemeMediaQuery)
      : null;

  if (mediaQuery) {
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncTheme);
    } else {
      mediaQuery.addListener?.(syncTheme);
    }
  }

  return () => {
    observer.disconnect();
    if (!mediaQuery) return;
    if (typeof mediaQuery.removeEventListener === 'function') {
      mediaQuery.removeEventListener('change', syncTheme);
    } else {
      mediaQuery.removeListener?.(syncTheme);
    }
  };
}
