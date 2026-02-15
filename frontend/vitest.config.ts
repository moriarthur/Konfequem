import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom environment for DOM testing
    environment: 'jsdom',

    // Global setup file
    setupFiles: ['./__tests__/setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.config.{js,ts}',
        'src/main.jsx',
        'src/vite-env.d.ts',
      ],
      // Coverage thresholds
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    
    // Include files for testing
    include: ['**/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    
    // Exclude files
    exclude: ['node_modules', 'dist'],
    
    // Global variables
    globals: true,
    
    // Test timeout
    testTimeout: 10000,
    
    // Isolate tests
    isolate: true,
    
    // Pool options for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
  
  // Path aliases (matching Vite's resolve.alias)
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@utils': '/src/utils',
      '@context': '/src/context',
      '@pages': '/src/pages',
    },
  },
})
