import '@testing-library/jest-dom/vitest';
// Ensures every test has a registered i18next instance (via initReactI18next)
// before rendering, so components calling useTranslation() work even in
// test files that don't happen to import lib/i18n.ts transitively.
import '../lib/i18n';
