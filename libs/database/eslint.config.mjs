import baseConfig from '../../eslint.base.config.mjs';

export default [
  ...baseConfig,

  /*
   * Prisma Client is generated at workspace root:
   *
   *   generated/prisma
   *
   * The database library is the intentional adapter boundary
   * between generated Prisma code and the rest of Payflow.
   *
   * Only these adapter files may access the generated client
   * through its relative generated path.
   */
  {
    files: [
      'src/lib/prisma/prisma.service.ts',
      'src/lib/prisma/prisma-types.ts',
    ],

    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
];
