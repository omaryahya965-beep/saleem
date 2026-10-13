import { DirectionProvider } from "@radix-ui/react-direction";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import ar from "./ar.json";
import en from "./en.json";

export type Lang = "ar" | "en";
export type Dir = "rtl" | "ltr";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every translatable key, derived from ar.json (the source of truth). */
export type TKey = Leaves<typeof ar>;
export type TParams = Record<string, string | number>;

const dictionaries: Record<Lang, unknown> = { ar, en };
const STORAGE_KEY = "saleem-lang";

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

/** Translate outside React (e.g. in tests or plain utilities). */
export function translate(lang: Lang, key: TKey, params?: TParams): string {
  const raw = lookup(dictionaries[lang], key) ?? lookup(dictionaries.ar, key) ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

export function localeOf(lang: Lang): string {
  // Gregorian calendar + Latin digits keep dates, times and hashes consistent across languages.
  return lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
}

export interface I18n {
  lang: Lang;
  dir: Dir;
  setLang: (l: Lang) => void;
  t: (key: TKey, params?: TParams) => string;
  /**
   * Plural-aware translation: looks up `<base>.<category>` where category comes from
   * Intl.PluralRules (Arabic: zero/one/two/few/many/other; English: one/other). `{n}` is the count.
   */
  tn: (base: string, n: number, params?: TParams) => string;
  formatDate: (value: string | Date | null | undefined, withTime?: boolean) => string;
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
  formatBytes: (bytes: number) => string;
}

const I18nContext = createContext<I18n | null>(null);

function readInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") return saved;
  } catch {
    // Storage may be unavailable (private mode); fall back to Arabic.
  }
  return "ar";
}

export function I18nProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? readInitialLang());
  const dir: Dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
    setLangState(l);
  }, []);

  const value = useMemo<I18n>(() => {
    const locale = localeOf(lang);
    return {
      lang,
      dir,
      setLang,
      t: (key, params) => translate(lang, key, params),
      tn: (base, n, params) => {
        const cat = new Intl.PluralRules(lang).select(n);
        const dict = dictionaries[lang];
        const key =
          lookup(dict, `${base}.${cat}`) !== undefined ? `${base}.${cat}` : `${base}.other`;
        return translate(lang, key as TKey, { n, ...params });
      },
      formatDate: (value, withTime = false) => {
        if (!value) return "—";
        const d = typeof value === "string" ? new Date(value) : value;
        if (Number.isNaN(d.getTime())) return "—";
        return new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
          ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
        }).format(d);
      },
      formatNumber: (n, opts) => new Intl.NumberFormat(locale, opts).format(n),
      formatBytes: (bytes) => {
        const mb = bytes / (1024 * 1024);
        const unit = translate(lang, mb >= 1 ? "units.mb" : "units.kb");
        const n = mb >= 1 ? mb : bytes / 1024;
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)} ${unit}`;
      },
    };
  }, [lang, dir, setLang]);

  return (
    <I18nContext.Provider value={value}>
      <DirectionProvider dir={dir}>{children}</DirectionProvider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Media time as mm:ss with zero padding, e.g. 12 → "00:12", 75 → "01:15". */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
