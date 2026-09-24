import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { UserConfig as VitestUserConfig } from 'vitest/config'

/**
 * The one file under src/lib that needs a DOM. Named once, because the `logic`
 * project excludes it and the `logic-dom` project includes it, and those two
 * must not drift apart: a typo in either would run it twice or not at all, and
 * neither failure announces itself.
 */
const LIB_NEEDS_DOM = 'src/lib/preflop/briefed.test.ts'

/**
 * Almost every test here is pure logic — card maths, range charts, the
 * hand-history parser — and never touches a document. Running all of them under
 * one jsdom config charged every one for a DOM it does not read: src/lib alone
 * spent 5.17s of a 5.31s run constructing environments, against 2ms under node.
 *
 * So the suite is split by what a test actually needs rather than by what is
 * convenient to configure. `logic` is the narrow, explicit half — src/lib, the
 * node environment, and no React setup file. `dom` is the catch-all: anything
 * under src/ that is not src/lib keeps jsdom and the testing-library setup, so
 * a new component, hook or mode directory is picked up without anyone having to
 * remember to list it here. Between them the includes cover src/ exactly once,
 * and that is the property to preserve if these globs are ever edited — a split
 * that quietly stops running a directory is worse than the slow config it
 * replaced.
 *
 * Both includes are anchored at src/ deliberately. Vitest's default include is
 * repo-wide, and this repo grows .claude/worktrees/ checkouts that each hold a
 * full copy of the suite; unanchored, every one of them gets collected too.
 *
 * These settings stay in vite.config.ts instead of moving to a vitest.config.ts
 * of their own: a standalone vitest config takes precedence over this file, so
 * it would have to re-declare the React plugin for the .tsx tests and keep that
 * copy in step with the real one. Here, each project says `extends: true` and
 * inherits the same plugin pipeline the app is built with.
 */
const vitestConfig = {
  test: {
    globals: true,
    css: false,
    // The heaviest logic tests deal tens of thousands of spots; the 5s default
    // trips them under parallel load on a slow box, and which one loses the
    // race varies per run. Raised suite-wide rather than per-test to stop the
    // whack-a-mole.
    testTimeout: 20000,
    projects: [
      {
        extends: true,
        test: {
          name: 'logic',
          environment: 'node',
          include: ['src/lib/**/*.test.ts'],
          exclude: [LIB_NEEDS_DOM],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/lib/**/*.test.ts'],
        },
      },
      {
        /**
         * briefed.test.ts sits under src/lib among the pure logic, but it reads
         * and clears localStorage, so it is the single file there that really
         * does need a DOM. It gets its own project rather than being left in
         * `logic`, where it fails with `ReferenceError: localStorage is not
         * defined` — a message that reads like a broken import and sends you
         * looking in the module rather than at the environment.
         *
         * If you are here to fold this third project back into `logic` because
         * three projects for one file looks like clutter: that is the failure
         * you are about to reintroduce.
         *
         * It wants the environment and nothing else, so it does not get the
         * testing-library setup file — there is no component under test.
         */
        extends: true,
        test: {
          name: 'logic-dom',
          environment: 'jsdom',
          include: [LIB_NEEDS_DOM],
        },
      },
    ],
  },
} satisfies VitestUserConfig

// https://vite.dev/config/
export default defineConfig({
  base: '/bluff-catcher/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'bluff-catcher',
        short_name: 'bluff-catcher',
        description: 'Poker odds drill — estimate your chance to improve by the river.',
        theme_color: '#161826',
        background_color: '#161826',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  ...vitestConfig,
})
