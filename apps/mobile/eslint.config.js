const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Règles du React Compiler activées par eslint-config-expo 57 : signalent du code existant,
    // rétrogradées en avertissements le temps d'un lot de mise en conformité (voir docs/DECISIONS.md).
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  { ignores: ['dist/*', '.expo/*'] },
]);
