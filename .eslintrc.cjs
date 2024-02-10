module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json", "./test/tsconfig.json"],
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict",
    "prettier",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-exports": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-unnecessary-type-assertion": "warn",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    eqeqeq: "error",
  },
};
