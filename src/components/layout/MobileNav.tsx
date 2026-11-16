import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  X, 
  ChevronDown, 
  ChevronUp, 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  ShieldCheck, 
  Users, 
  BarChart3, 
  Building2,
  LogOut,
  Info,
  ClipboardList,
  CalendarClock,
  History,
  Activity,
  KeyRound,
  HelpCircle,
  Moon,
  Sun,
  Workflow,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import Tooltip from '@/components/ui/Tooltip';

// ============================================================================
// TIPOS
// ============================================================================

interface MobileNavItem {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  roles: string[];
  submenu?: MobileNavItem[];
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const drawerRef = useRef<HTMLDivElement>(null);

  // Prevenir scroll quando drawer está aberto
  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const drawer = drawerRef.current;
    const getFocusableItems = () => drawer?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    getFocusableItems()?.[0]?.focus();

    const handleDrawerKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const items = getFocusableItems();
      if (!items?.length) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    window.addEventListener('keydown', handleDrawerKeys);
    return () => {
      window.removeEventListener('keydown', handleDrawerKeys);
      if (drawer?.contains(document.activeElement)) {
        window.requestAnimationFrame(() => document.getElementById('mobile-menu-toggle')?.focus());
      }
    };
  }, [isOpen, onClose]);

  // Definir itens do mobile nav
  const getMobileNavItems = (): MobileNavItem[] => {
    const items: MobileNavItem[] = [
      {
        id: 'ajuda',
        label: 'Central de ajuda',
        href: '/ajuda',
        icon: <HelpCircle className="w-5 h-5" />,
        roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
      },
      {
        id: 'dashboard',
        label: 'Painel de Controle',
        href: '/rdos',
        icon: <LayoutDashboard className="w-5 h-5" />,
        roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
      },
      {
        id: 'rdo',
        label: 'Relatórios Diários',
        icon: <ClipboardList className="w-5 h-5" />,
        roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
        submenu: [
          {
            id: 'rdo-listar',
            label: 'Listagem de RDOs',
            href: '/rdos',
            icon: <FileText className="w-4 h-4" />,
            roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
          },
          {
            id: 'rdo-novo',
            label: 'Gerar Novo RDO',
            href: '/rdo/novo',
            icon: <PlusCircle className="w-4 h-4" />,
            roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
          },
        ],
      },
    ];

    if (profile && ['admin', 'supervisor'].includes(profile.profile)) {
      items.push(
        {
          id: 'exportacoes',
          label: 'Exportações agendadas',
          href: '/admin/exportacoes-agendadas',
          icon: <CalendarClock className="w-5 h-5" />,
          roles: ['admin', 'supervisor'],
        },
        {
          id: 'historico-exportacoes',
          label: 'Histórico de exportações',
          href: '/admin/historico-exportacoes',
          icon: <History className="w-5 h-5" />,
          roles: ['admin', 'supervisor'],
        },
      );
    }

    // Seção Administrativa
    if (profile?.profile === 'admin') {
      items.push({
        id: 'admin',
        label: 'Administração',
        icon: <ShieldCheck className="w-5 h-5" />,
        roles: ['admin'],
        submenu: [
          {
            id: 'admin-unidades',
            label: 'Unidades da obra',
            href: '/admin/unidades',
            icon: <Building2 className="w-4 h-4" />,
            roles: ['admin'],
          },
          {
            id: 'admin-cadastros-rdo',
            label: 'Funções e equipamentos',
            href: '/admin/cadastros-rdo',
            icon: <ClipboardList className="w-4 h-4" />,
            roles: ['admin'],
          },
          {
            id: 'admin-dashboard',
            label: 'Dashboard Executivo',
            href: '/admin/dashboard',
            icon: <BarChart3 className="w-4 h-4" />,
            roles: ['admin'],
          },
          {
            id: 'admin-usuarios',
            label: 'Gestão de Usuários',
            href: '/admin/usuarios',
            icon: <Users className="w-4 h-4" />,
            roles: ['admin'],
          },
          {
            id: 'admin-integracoes',
            label: 'Integração Protheus',
            href: '/admin/integracoes/protheus',
            icon: <Workflow className="w-4 h-4" />,
            roles: ['admin'],
          },
          {
            id: 'admin-monitoramento',
            label: 'Monitoramento',
            href: '/admin/monitoramento',
            icon: <Activity className="w-4 h-4" />,
            roles: ['admin'],
          },
        ],
      });
    }

    return items;
  };

  const navItems = getMobileNavItems();
  const visibleItems = navItems.filter((item) =>
    profile ? item.roles.includes(profile.profile) : false
  );

  const toggleSubmenu = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = (href?: string) => href ? location.pathname === href : false;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
      onClose();
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
    }
  };

  return (
    <>
      {/* Overlay de fundo */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Menu Lateral (Drawer) */}
      <div
        ref={drawerRef}
        id="menu-navegacao-mobile"
        aria-hidden={!isOpen}
        aria-label="Menu de navegação"
        aria-modal={isOpen || undefined}
        className={`
          fixed inset-y-0 left-0 z-[70] w-full max-w-[280px]
          bg-background shadow-2xl overflow-y-auto
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full pointer-events-none'}
        `}
        role="dialog"
      >
        {/* Topo do Menu */}
        <div className="sticky top-0 z-50 flex items-center justify-between bg-primary p-6 text-primary-foreground">
          <div className="flex items-center gap-3">
            <img src="/logo-relat-pro-rdo.png" alt="" className="h-8 w-8 object-contain" />
            <span className="font-bold text-lg tracking-tight">Relat Pro RDO</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition" title="Fechar menu" aria-label="Fechar menu de navegação">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Links de Navegação */}
        <nav className="p-4 space-y-2">
          {visibleItems.map((item) => {
            const hasSubmenu = !!(item.submenu && item.submenu.length > 0);
            const isExpanded = expandedItems.has(item.id);
            const active = isActive(item.href);

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => hasSubmenu ? toggleSubmenu(item.id) : item.href && navigate(item.href)}
                  className={`
                    w-full flex items-center justify-between px-4 py-3 rounded-xl
                    transition-all duration-200 font-bold text-sm
                    ${active ? 'bg-[#FBBF24] text-[#0F2A4A] shadow-sm border border-[#FBBF24]' : 'text-gray-600 hover:bg-gray-50'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className={active ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>

                  {hasSubmenu && (
                    <div className="text-gray-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  )}
                </button>

                {/* Renderização Segura do Submenu */}
                {hasSubmenu && isExpanded && (
                  <div className="ml-6 pl-4 border-l-2 border-blue-100 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {item.submenu?.map((subitem) => {
                      const subActive = isActive(subitem.href);
                      return (
                        <button
                          key={subitem.id}
                          onClick={() => subitem.href && navigate(subitem.href)}
                          className={`
                            w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
                            transition-colors text-sm font-semibold
                            ${subActive ? 'text-[#0F2A4A] bg-[#FBBF24]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                          `}
                        >
                          <span className={subActive ? 'text-blue-500' : 'text-gray-300'}>{subitem.icon}</span>
                          <span>{subitem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Caixa de Ajuda */}
        <div className="m-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Info size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Suporte</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Em caso de dúvidas sobre o preenchimento do RDO, consulte o supervisor da sua unidade.
          </p>
        </div>

        {/* Seção do Usuário e Sair */}
        <div className="mt-auto p-4 border-t border-gray-100 space-y-4">
          <Tooltip label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} position="top">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {theme === 'dark' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
              {theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            </button>
          </Tooltip>
          <div className="flex min-w-0 items-center gap-3 px-4 py-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-100 font-bold text-blue-700">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-all text-sm font-bold text-gray-900">{user?.email || 'Usuário'}</p>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">{profile?.profile}</p>
            </div>
          </div>

          <button
            onClick={() => {
              navigate('/conta/senha');
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <KeyRound size={18} />
            Trocar senha
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all font-bold text-sm"
          >
            <LogOut size={18} />
            Encerrar Sessão
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileNav;
