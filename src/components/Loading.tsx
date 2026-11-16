import React from 'react';

/**
 * Componente Loading: exibe "Carregando..." centralizado na tela
 * usando Flexbox para centralização vertical e horizontal.
 */
const Loading: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
    }}
  >
    Carregando...
  </div>
);

export default Loading;