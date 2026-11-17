import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "src/generated/**", "next-env.d.ts"]),
  {
    rules: {
      // Components ported from the reference UI use `any` for loosely typed user objects.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // The ported UI layer uses mount-flag / portal / measured-ref patterns that the newer React rules flag. They are
    // intentional there (hydration-safe portals), so surface them as warnings only for that layer.
    files: ["src/components/**/*.{ts,tsx}"],
    rules: { "react-hooks/set-state-in-effect": "warn", "react-hooks/refs": "warn" },
  },
]);
