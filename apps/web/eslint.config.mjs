import baseConfig from '../../eslint.base.config.mjs';
import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  {
    ignores: ['.next/**/*'],
  },
];
