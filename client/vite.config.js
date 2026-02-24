import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json'

export default defineConfig({
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(packageJson.version)
  },
  // In production, assets are served by Django/Whitenoise under /static/.
  // Using /static/ here ensures built JS/CSS paths match Django STATIC_URL.
  base: '/static/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      manifestFilename: 'manifest.json',
      devOptions: {
        enabled: false,
        type: 'module',
      },
      manifest: {
        name: 'ROTC Grading System',
        short_name: 'ROTC GSMS',
        description: 'ROTC Grading and Management System',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.webp', sizes: '192x192', type: 'image/webp', purpose: 'any maskable' },
          { src: 'pwa-512x512.webp', sizes: '512x512', type: 'image/webp', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        globIgnores: ['**/node_modules/**/*', 'sw.js']
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg']
    })
  ],
  // Performance optimization: Build configuration
  // Validates Requirements: 5.1, 5.3, 5.5
  build: {
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal loading
        manualChunks: {
          // Core vendor libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI components and icons
          'vendor-ui': ['lucide-react', 'react-hot-toast', 'recharts'],
          // Utilities and helpers
          'vendor-utils': ['axios', 'idb', 'clsx', 'tailwind-merge'],
          // Image and document processing
          'vendor-media': ['browser-image-compression', 'html2canvas', 'qrcode', 'html5-qrcode'],
        },
      },
    },
    // Chunk size warning limit
    chunkSizeWarningLimit: 500,
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    },
    // Source maps for debugging (disable in production for smaller builds)
    sourcemap: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
