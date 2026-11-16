import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Building2, CalendarClock, ChevronDown, ChevronUp, ClipboardList, History, HelpCircle, Workflow } from 'lucide-react';

// 
// TIPOS
// 

interface SidebarItem {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  roles: string[];
  submenu?: SidebarItem[];
}

// 
// COMPONENTE PRINCIPAL
// 

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const getSidebarItems = (): SidebarItem[] => {
    const items: SidebarItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/rdos',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        ),
        roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
      },
      {
        id: 'exportacoes',
        label: 'Exportações agendadas',
        href: '/admin/exportacoes-agendadas',
        icon: <CalendarClock className="h-5 w-5" />,
        roles: ['admin', 'supervisor'],
      },
      {
        id: 'exportacoes-historico',
        label: 'Histórico de exportações',
        href: '/admin/historico-exportacoes',
        icon: <History className="h-5 w-5" />,
        roles: ['admin', 'supervisor'],
      },
      {
        id: 'rdo',
        label: 'Relatórios',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ),
        roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
        submenu: [
          {
            id: 'rdo-listar',
            label: 'Meus RDOs',
            href: '/rdos',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            ),
            roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
          },
          {
            id: 'rdo-novo',
            label: 'Novo RDO',
            href: '/rdo/novo',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            ),
            roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'],
          },
        ],
      },
    ];

    if (profile?.profile === 'admin') {
      items.push({
        id: 'admin',
        label: 'Administração',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        ),
        roles: ['admin'],
        submenu: [
          {
            id: 'admin-unidades',
            label: 'Unidades da obra',
            href: '/admin/unidades',
            icon: <Building2 className="h-4 w-4" />,
            roles: ['admin'],
          },
          {
            id: 'admin-cadastros-rdo',
            label: 'Funções e equipamentos',
            href: '/admin/cadastros-rdo',
            icon: <ClipboardList className="h-4 w-4" />,
            roles: ['admin'],
          },
          {
            id: 'admin-dashboard',
            label: 'Dashboard Executivo',
            href: '/admin/dashboard',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            ),
            roles: ['admin'],
          },
          {
            id: 'admin-usuarios',
            label: 'Gerenciar Usuários',
            href: '/admin/usuarios',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 12H9m6 0a6 6 0 11-12 0 6 6 0 0112 0z"
                />
              </svg>
            ),
            roles: ['admin'],
          },
          {
            id: 'admin-integracoes',
            label: 'Integração Protheus',
            href: '/admin/integracoes/protheus',
            icon: <Workflow className="h-4 w-4" />,
            roles: ['admin'],
          },
        ],
      });
    }

    return items;
  };

  const sidebarItems = getSidebarItems();
  
  // Filtrar itens visíveis baseado no profile do usuário
  const visibleItems = sidebarItems.filter((item) => {
    const userRole = profile?.profile ?? '';
    return userRole && item.roles.includes(userRole);
  });

  const toggleSubmenu = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = (href?: string): boolean => {
    if (!href) return false;
    return location.pathname === href;
  };

  const isSubmenuActive = (item: SidebarItem): boolean => {
    if (item.href && isActive(item.href)) return true;
    if (item.submenu && item.submenu.length > 0) {
      return item.submenu.some((sub) => isActive(sub.href));
    }
    return false;
  };

  return (
    <aside aria-label="Navegação lateral" className="app-sidebar sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r lg:flex">
      <div className="flex-1 overflow-y-auto">
        <nav aria-label="Seções do sistema" className="px-4 py-6 space-y-1">
          {visibleItems.map((item) => {
            const hasSubmenu = item.submenu !== undefined && item.submenu.length > 0;
            const isExpanded = expandedItems.has(item.id);
            const active = isSubmenuActive(item);

            return (
              <div key={item.id}>
                <button
                  onClick={() => {
                    if (hasSubmenu) {
                      toggleSubmenu(item.id);
                    } else if (item.href) {
                      navigate(item.href);
                    }
                  }}
                  className={`sidebar-link ${active ? 'sidebar-active' : ''}
                    w-full flex items-center justify-between px-4 py-3 rounded-lg
                    transition-all duration-200 font-medium text-sm
                  `}
                  aria-label={item.label}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>

                  {hasSubmenu && (
                    <div
                      className={`
                        transition-transform duration-200
                        ${isExpanded ? 'rotate-180' : ''}
                      `}
                      aria-hidden="true"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  )}
                </button>

                {hasSubmenu && isExpanded && item.submenu && (
                  <div className="mt-1 ml-4 pl-4 border-l-2 border-gray-200 space-y-1">
                    {item.submenu.map((subitem) => {
                      const userRole = profile?.profile ?? '';
                      const visibleSubitem = userRole && subitem.roles.includes(userRole);

                      if (!visibleSubitem) return null;

                      return (
                        <button
                          key={subitem.id}
                          onClick={() => {
                            if (subitem.href) navigate(subitem.href);
                          }}
                          className={`sidebar-link ${isActive(subitem.href) ? 'sidebar-active' : ''}
                            w-full flex items-center gap-3 px-4 py-2 rounded-lg
                            transition-all duration-200 text-sm font-medium
                          `}
                          aria-label={subitem.label}
                        >
                          {subitem.icon}
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
      </div>

      <div className="border-t border-gray-200 p-4">
        <button
          type="button"
          onClick={() => navigate('/ajuda')}
          className={`sidebar-link mb-3 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
            location.pathname === '/ajuda'
              ? 'sidebar-active'
              : ''
          }`}
          aria-current={location.pathname === '/ajuda' ? 'page' : undefined}
          title="Abra respostas sobre o uso do sistema"
        >
          <HelpCircle aria-hidden="true" className="h-5 w-5" />
          Central de ajuda
        </button>
        <div className="sidebar-tip rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-4 h-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs font-semibold text-blue-900">
              Dica do Dia
            </span>
          </div>
          <p className="text-xs text-blue-700 leading-relaxed">
            Você pode adicionar até 10 evidências por RDO. Use fotos e documentos para melhorar a rastreabilidade.
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
