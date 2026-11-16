import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { useAuth } from '@/hooks/useAuth';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell flex flex-col">
      <a
        className="sr-only z-[100] rounded bg-white p-3 text-blue-800 shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        href="#conteudo-principal"
      >
        Pular para o conteúdo
      </a>
      <Header />

      <div className="flex min-w-0 flex-1">
        <Sidebar />

        <main id="conteudo-principal" className="app-main min-w-0 flex-1" tabIndex={-1}>
          <div className="app-content">
            {children}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default MainLayout;
