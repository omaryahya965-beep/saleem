import "@testing-library/jest-dom/vitest";
import { loadDictionary } from "@/i18n";

// English is a lazily loaded chunk in the app; tests translate both languages synchronously.
await loadDictionary("en");

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
