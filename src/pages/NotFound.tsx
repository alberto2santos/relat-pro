import React from 'react';

/**
 * Componente NotFound: exibe "Página não encontrada" centralizado na tela
 * usando Flexbox para centralização vertical e horizontal.
 */
const NotFound: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
    }}
  >
    Página não encontrada
  </div>
);

export default NotFound;