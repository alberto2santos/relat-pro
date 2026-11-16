import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/contexts/NotificationContext';
import type { ProfilesRow } from '@/lib/supabase';
import { 
  Menu, 
  X, 
  LogOut, 
  ChevronDown, 
  LayoutDashboard, 
  FilePlus, 
  ShieldCheck, 
  Users, 
  BarChart3,
  Building2,
  CalendarClock,
  Clock3,
  History,
  KeyRound,
  HelpCircle,
  Moon,
  Sun,
  Workflow,
} from 'lucide-react';
import MobileNav from './MobileNav';
import { useTheme } from '@/contexts/ThemeContext';
import Tooltip from '@/components/ui/Tooltip';

// ============================================================================
// TIPOS
// ============================================================================

interface NavLink {
  id: string;
  label: string;
  href: string;
  roles: string[];
  icon: React.ReactNode;
  submenu?: NavLink[];
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut } = useAuth(); // Corrigido: signOut em vez de logout
  const { warning } = useNotification();
  const { theme, toggleTheme } = useTheme();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [expandedSubmenu, setExpandedSubmenu] = useState<string | null>(null);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  // Fechar menus ao navegar
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Definir links de navegação por perfil
  const getNavLinks = (): NavLink[] => {
    const baseLinks: NavLink[] = [
      {
        id: 'rdos',
        label: 'Painel RDO',
        href: '/rdos',
        roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
        icon: <LayoutDashboard className="w-5 h-5" />,
      },
      {
        id: 'novo-rdo',
        label: 'Novo RDO',
        href: '/rdo/novo',
        roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
        icon: <FilePlus className="w-5 h-5" />,
      },
    ];

    if (profile && ['admin', 'supervisor'].includes(profile.profile)) {
      baseLinks.push({
        id: 'exportacoes',
        label: 'Exportações',
        href: '/admin/exportacoes-agendadas',
        roles: ['admin', 'supervisor'],
        icon: <CalendarClock className="w-5 h-5" />,
      });
      baseLinks.push({
        id: 'historico-exportacoes',
        label: 'Histórico',
        href: '/admin/historico-exportacoes',
        roles: ['admin', 'supervisor'],
        icon: <History className="w-5 h-5" />,
      });
    }

    // Links administrativos
    if (profile?.profile === 'admin') {
      baseLinks.push({
        id: 'admin',
        label: 'Administração',
        href: '#',
        roles: ['admin'],
        icon: <ShieldCheck className="w-5 h-5" />,
        submenu: [
          {
            id: 'admin-unidades',
            label: 'Unidades da obra',
            href: '/admin/unidades',
            roles: ['admin'],
            icon: <Building2 className="w-4 h-4" />,
          },
          {
            id: 'admin-dashboard',
            label: 'Métricas Executivas',
            href: '/admin/dashboard',
            roles: ['admin'],
            icon: <BarChart3 className="w-4 h-4" />,
          },
          {
            id: 'admin-usuarios',
            label: 'Gestão de Usuários',
            href: '/admin/usuarios',
            roles: ['admin'],
            icon: <Users className="w-4 h-4" />,
          },
          {
            id: 'admin-monitoramento',
            label: 'Monitoramento',
            href: '/admin/monitoramento',
            roles: ['admin'],
            icon: <Clock3 className="w-4 h-4" />,
          },
          {
            id: 'admin-integracoes',
            label: 'Integração Protheus',
            href: '/admin/integracoes/protheus',
            roles: ['admin'],
            icon: <Workflow className="w-4 h-4" />,
          },
        ],
      });
    }

    return baseLinks;
  };

  const navLinks = getNavLinks();
  const visibleLinks = navLinks.filter((link) =>
    profile ? link.roles.includes(profile.profile) : false
  );

  // Handler logout
  const handleLogout = async () => {
    try {
      await signOut(); // Corrigido para usar a função correta do hook
      navigate('/login', { replace: true });
      setUserMenuOpen(false);
    } catch (error) {
      warning(
        'Erro ao encerrar sessão',
        error instanceof Error ? error.message : 'Tente novamente'
      );
    }
  };

  if (!user || !profile) {
    return null;
  }

  const isActive = (href: string) => location.pathname === href;

  const handleNavigation = (link: NavLink) => {
    if (link.submenu && link.submenu.length > 0) {
      setExpandedSubmenu(expandedSubmenu === link.id ? null : link.id);
    } else if (link.href !== '#') {
      navigate(link.href);
    }
  };

  return (
    <>
      <header className="app-header sticky top-0 z-40 w-full border-b">
        <nav aria-label="Navegação principal" className="mx-auto w-full max-w-[106rem] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 min-w-0 items-center justify-between gap-3 lg:pl-64">
            
            {/* Logo e Identificação */}
            <div className="flex-shrink-0">
              <button
                onClick={() => navigate('/')}
                aria-label="Relat Pro RDO - página inicial"
                className="flex items-center gap-3 hover:opacity-80 transition"
              >
                <img
                  src="/logo-relat-pro-rdo-fundo-branco.png"
                  alt=""
                  width="56"
                  height="56"
                  className="h-14 w-14 rounded-lg bg-white object-contain lg:hidden"
                />
                <img
                  src="/logo-relat-pro-rdo.png"
                  alt=""
                  width="56"
                  height="56"
                  className="hidden h-14 w-14 rounded-lg bg-white object-contain lg:block"
                />
                <span className="hidden sm:inline font-bold text-xl text-gray-900 tracking-tight">
                  Relat Pro <span className="brand-accent">RDO</span>
                </span>
              </button>
            </div>

            {/* Navegação Desktop */}
            <div className="hidden min-w-0 items-center gap-1 2xl:flex 2xl:gap-2">
              {visibleLinks.map((link) => (
                <div key={link.id} className="relative group">
                  <button
                    onClick={() => handleNavigation(link)}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    className={`header-nav-link
                      flex items-center gap-2 rounded-xl px-2.5 py-2 font-semibold text-xs transition-all duration-200 xl:px-3 xl:text-sm
                      ${
                        isActive(link.href)
                          ? 'bg-blue-50 text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }
                    `}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                    {link.submenu && link.submenu.length > 0 && (
                      <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
                    )}
                  </button>

                  {/* Submenu Desktop */}
                  {link.submenu && link.submenu.length > 0 && (
                    <div className="header-dropdown absolute left-0 z-50 mt-1 w-52 rounded-xl border p-1 opacity-0 shadow-xl invisible transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                      {link.submenu.map((subitem) => (
                        <button
                          key={subitem.id}
                          onClick={() => navigate(subitem.href)}
                          className={`header-nav-link
                            w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg
                            ${
                              isActive(subitem.href)
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }
                          `}
                        >
                          {subitem.icon}
                          <span>{subitem.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Lado Direito: Menu de Usuário */}
            <div className="flex items-center gap-2">
              <Tooltip label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="header-icon-button rounded-xl p-2 transition"
                  aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
                  title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
                >
                  {theme === 'dark' ? <Sun aria-hidden="true" className="h-5 w-5" /> : <Moon aria-hidden="true" className="h-5 w-5" />}
                </button>
              </Tooltip>
              <Tooltip label="Acesse respostas sobre preenchimento, revisão e exportação de RDOs">
                <button
                  type="button"
                  onClick={() => navigate('/ajuda')}
                  className="header-icon-button rounded-xl p-2 transition"
                  aria-label="Abrir central de ajuda"
                  title="Abrir central de ajuda"
                >
                  <HelpCircle aria-hidden="true" className="h-5 w-5" />
                </button>
              </Tooltip>
              <div className="relative hidden xl:block">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="header-account flex items-center gap-3 rounded-full border px-3 py-1.5 shadow-sm transition-all"
                  aria-label="Abrir menu da conta"
                  title="Abrir opções da conta"
                >
                  <div className="text-right leading-tight">
                    <div className="text-xs font-bold">
                      {user.email?.split('@')[0] || 'Usuário'}
                    </div>
                    <div className="header-account-role text-[10px] font-bold uppercase tracking-tighter">
                      {profile.profile}
                    </div>
                  </div>
                  <div className="header-avatar flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>

                {userMenuOpen && (
                  <UserMenu
                    profile={profile}
                    email={user.email || ''}
                    onLogout={handleLogout}
                    onChangePassword={() => {
                      navigate('/conta/senha');
                      setUserMenuOpen(false);
                    }}
                  />
                )}
              </div>

              {/* Toggle Mobile */}
              <button
                id="mobile-menu-toggle"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="header-icon-button rounded-lg p-2 transition-colors 2xl:hidden"
                aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="menu-navegacao-mobile"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </nav>
      </header>

      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
      />
    </>
  );
};

// ============================================================================
// COMPONENTE AUXILIAR: USER MENU
// ============================================================================

interface UserMenuProps {
  profile: ProfilesRow;
  email: string;
  onLogout: () => void;
  onChangePassword: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ profile, email, onLogout, onChangePassword }) => (
  <div className="header-dropdown absolute right-0 z-50 mt-3 w-64 rounded-2xl border py-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
    <div className="px-5 py-4 border-b border-gray-100">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Minha conta</p>
      {profile.full_name && <p className="text-sm font-semibold text-gray-900">{profile.full_name}</p>}
      <p className="text-sm font-bold text-gray-900">
        {email || 'Colaborador'}
      </p>
      <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 mt-2 uppercase">
        {profile.profile}
      </div>
    </div>

    <div className="p-1">
      <button
        onClick={onChangePassword}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-all font-semibold rounded-xl"
      >
        <KeyRound className="w-4 h-4" />
        Trocar senha
      </button>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all font-bold rounded-xl"
      >
        <LogOut className="w-4 h-4" />
        Sair do Sistema
      </button>
    </div>
  </div>
);

export default Header;
