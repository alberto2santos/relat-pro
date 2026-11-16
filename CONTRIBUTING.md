# Contribuindo

Obrigado por contribuir com o Relat Pro RDO. Antes de abrir uma alteração, confirme que ela é compatível com as regras de acesso e o fluxo de revisão documentados em [docs/arquitetura.md](docs/arquitetura.md).

## Preparar o ambiente

Siga as instruções de instalação do [README](README.md). Mudanças no banco devem ser implementadas em uma nova migration Supabase; não altere migrations já aplicadas em ambientes compartilhados.

## Validar alterações

Execute os validadores adequados ao escopo:

```bash
npm run lint
npm run build
npx supabase test db --local
```

O teste do banco requer Docker Desktop e Supabase local em execução. O workflow de CI executa auditoria de dependências, lint, build e pgTAP em pull requests.

## Pull requests

- Descreva o problema e a solução, incluindo impactos para os usuários.
- Inclua passos de reprodução e validação para correções de comportamento.
- Atualize a documentação relacionada quando mudar comandos, permissões, integrações ou limitações conhecidas.
- Não inclua credenciais, dados de produção, assinaturas, fotos ou informações pessoais.
