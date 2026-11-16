import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import './styles/globals.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error(
    "Falha crítica: Elemento raiz (#root) não foi encontrado no DOM. Verifique o seu index.html."
  );
}

createRoot(container).render(
  <React.StrictMode>
    <App />
    {import.meta.env.PROD && <Analytics />}
  </React.StrictMode>
);
