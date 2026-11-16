import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const Footer = () => {
  const { user, profile } = useAuth();

  if (!user || !profile) return null;

  const links = [
    { label: 'Relatórios', href: '/rdos', roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'] },
    { label: 'Central de ajuda', href: '/ajuda', roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'] },
    { label: 'Novo RDO', href: '/rdo/novo', roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'] },
    { label: 'Gestão de usuários', href: '/admin/usuarios', roles: ['admin'] },
    { label: 'Unidades da obra', href: '/admin/unidades', roles: ['admin'] },
    { label: 'Trocar senha', href: '/conta/senha', roles: ['admin', 'supervisor', 'engenheiro', 'encarregado'] },
  ].filter((link) => link.roles.includes(profile.profile));

  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-[106rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:pl-[18rem] lg:pr-8">
        <div className="max-w-xl">
          <p className="font-semibold text-foreground">Relat Pro RDO</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Gestão de obras com informação clara para equipes e gestores.
          </p>
        </div>

        <nav aria-label="Links do rodapé" className="flex flex-wrap gap-x-5 gap-y-3">
          {links.map((link) => (
            <Link
              key={link.href}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              to={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="text-xs text-muted-foreground lg:text-right">
          © {new Date().getFullYear()} Relat Pro RDO
        </p>
      </div>
    </footer>
  );
};

export default Footer;
