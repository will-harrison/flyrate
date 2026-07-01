import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// eslint-config-next@16 ships native ESLint 9 flat-config arrays. Spread the
// core-web-vitals bundle (base Next.js rules + web-vitals) and the TypeScript
// rules, then add project-specific ignores.
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "src/types/database.types.ts",
    ],
  },
];

export default eslintConfig;
