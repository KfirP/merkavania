import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // src/logic is pure game rules and must stay unit-testable without a renderer.
    files: ['src/logic/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'src/logic must not import Phaser (see CLAUDE.md).' }],
          patterns: [
            { group: ['phaser/*'], message: 'src/logic must not import Phaser (see CLAUDE.md).' },
          ],
        },
      ],
    },
  },
);
