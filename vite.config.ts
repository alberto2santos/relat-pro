import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2?,ttf,woff,eot}'],
        globIgnores: [
          '**/*.map',
          '**/logo-relat-pro-rdo.png',
          '**/logo-relat-pro-rdo-fundo-branco.png',
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Relat Pro RDO | Relatórios Diários de Obra',
        short_name: 'Relat Pro RDO',
        description: 'Registre, acompanhe e aprove relatórios diários de obra.',
        lang: 'pt-BR',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
        screenshots: [
          {
            src: '/screenshots/screenshot-dashboard.png',
            sizes: '1904x935',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Painel de relatórios diários de obra',
          },
          {
            src: '/screenshots/screenshot-painel-executivo.png',
            sizes: '1903x934',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Painel executivo com indicadores de RDO',
          },
          {
            src: '/screenshots/screenshot-newrdo.png',
            sizes: '1900x937',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Formulário para criar um novo RDO',
          },
          {
            src: '/screenshots/screenshot-historico-exportacao.png',
            sizes: '1895x938',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Histórico de exportações',
          },
        ],
      },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(projectDirectory, './src'),
      '@components': path.resolve(projectDirectory, './src/components'),
      '@utils': path.resolve(projectDirectory, './src/utils'),
      '@assets': path.resolve(projectDirectory, './src/assets'),
      '@pages': path.resolve(projectDirectory, './src/pages'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
});
