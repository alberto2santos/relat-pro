import { useMemo, useState } from 'react';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const FAQ_ITEMS = [
  {
    category: 'Começando',
    question: 'Como crio um RDO?',
    answer: 'Acesse “Novo RDO” pelo menu. Informe o número e a data; para escolher a unidade, abra o campo, digite parte do código ou do nome e selecione o resultado. Depois, preencha as horas, a disciplina e as observações; adicione os materiais, as fotos e a assinatura. Revise os dados e escolha “Finalizar e Enviar Relatório”. O RDO é criado e enviado para revisão.',
  },
  {
    category: 'Começando',
    question: 'O que significa cada status do RDO?',
    answer: 'Rascunho: ainda pode ser editado pelo responsável. Enviado: aguarda revisão. Aprovado: revisão concluída. Rejeitado: precisa de ajustes e pode ser editado novamente pelo responsável.',
  },
  {
    category: 'Começando',
    question: 'Posso duplicar o RDO do dia anterior?',
    answer: 'Sim. No formulário de novo RDO, selecione a unidade, a data e a disciplina e use “Duplicar RDO anterior”. São copiados as horas planejadas, os materiais, o efetivo por função e os equipamentos do RDO ativo mais recente da mesma unidade e disciplina, anterior à data selecionada. As horas realizadas e de uso voltam a zero; número, data, observações, clima, ocorrências, fotos e assinatura não são copiados. Confira tudo antes de salvar.',
  },
  {
    category: 'Preenchimento',
    question: 'Como registro materiais?',
    answer: 'Na seção “Materiais e Insumos”, selecione “Adicionar item” para cada material utilizado e preencha descrição, quantidade e unidade de medida na lista. A quantidade deve ser maior que zero.',
  },
  {
    category: 'Preenchimento',
    question: 'Quais arquivos posso anexar como evidência?',
    answer: 'O formulário aceita arquivos de imagem e tenta comprimi-los para cerca de 1 MiB antes do envio. Você pode adicionar mais de uma foto; confira a prévia e remova imagens incorretas antes de salvar. As imagens e a assinatura não são copiadas ao duplicar outro relatório.',
  },
  {
    category: 'Preenchimento',
    question: 'Preciso estar conectado à internet para preencher o RDO?',
    answer: 'Não, desde que você já tenha entrado e carregado as unidades pelo menos uma vez online neste dispositivo. Rascunhos, fotos e assinatura ficam salvos localmente e não são criptografados pela aplicação. Ao finalizar offline, o RDO será enviado para revisão automaticamente quando a conexão voltar, com o app aberto ou na próxima abertura; não há envio com o navegador fechado. Sair da conta não apaga os dados locais. Limpar os dados do navegador ou a remoção de armazenamento pelo sistema pode apagar itens ainda não sincronizados.',
  },
  {
    category: 'Revisão',
    question: 'Quem pode aprovar ou rejeitar um RDO?',
    answer: 'Administradores, supervisores e engenheiros podem revisar RDOs enviados. O encarregado acompanha os próprios relatórios. A aprovação ou rejeição registra uma ação no histórico de auditoria.',
  },
  {
    category: 'Revisão',
    question: 'Como corrijo um RDO rejeitado?',
    answer: 'Abra o relatório rejeitado e escolha editar. Ajuste os campos e materiais necessários e salve. Depois, envie novamente para revisão conforme as ações disponíveis no relatório.',
  },
  {
    category: 'Relatórios',
    question: 'Como exporto relatórios?',
    answer: 'Na listagem, aplique os filtros desejados e escolha CSV ou Excel. O Excel contém uma aba com os relatórios e outra com o resumo executivo. Na visualização de um RDO, use a ação de PDF para gerar o documento individual.',
  },
  {
    category: 'Conta e acesso',
    question: 'Esqueci minha senha ou preciso trocá-la. O que faço?',
    answer: 'Se estiver autenticado, abra o menu da conta e selecione “Trocar senha”. Para problemas de acesso ou um convite expirado, fale com o administrador do sistema.',
  },
  {
    category: 'Conta e acesso',
    question: 'Por que não consigo ver ou editar um relatório?',
    answer: 'As ações dependem do seu perfil e do estado do RDO. Encarregados veem os próprios relatórios; edição está disponível em rascunhos ou relatórios rejeitados, conforme as permissões. Se precisar de acesso, consulte o administrador ou supervisor.',
  },
  {
    category: 'Conta e acesso',
    question: 'Onde peço ajuda quando a dúvida não aparece aqui?',
    answer: 'Converse com o supervisor da sua unidade ou com o administrador do sistema. Informe o número do RDO e descreva a etapa em que ocorreu a dúvida. Não envie senhas, chaves de acesso ou links privados.',
  },
] as const;

const HelpPage = () => {
  const [search, setSearch] = useState('');
  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedSearch) return FAQ_ITEMS;
    return FAQ_ITEMS.filter(({ category, question, answer }) =>
      `${category} ${question} ${answer}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch),
    );
  }, [search]);

  const categories = [...new Set(filteredItems.map((item) => item.category))];

  return (
    <MainLayout>
      <section aria-labelledby="help-page-title" className="app-page">
        <header className="faq-hero flex flex-col gap-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
          <div className="flex items-start gap-4">
            <span className="rounded-2xl bg-blue-600 p-3 text-white shadow-lg shadow-blue-600/20">
              <HelpCircle aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <p className="mb-1 text-sm font-semibold text-blue-700">Central de ajuda</p>
              <h1 id="help-page-title" className="text-3xl font-bold tracking-tight text-slate-950">
                Dúvidas sobre o RDO?
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Encontre orientações rápidas para preencher, revisar e exportar relatórios.
              </p>
            </div>
          </div>
          <div className="w-full sm:max-w-sm">
            <label htmlFor="faq-search" className="sr-only">Buscar uma dúvida</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="faq-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar uma dúvida..."
                className="bg-white pl-10"
              />
            </div>
          </div>
        </header>

        {filteredItems.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {categories.map((category) => (
              <Card key={category} className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">{category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {filteredItems.filter((item) => item.category === category).map((item) => (
                    <details key={item.question} className="faq-item group rounded-xl border border-slate-200 bg-white transition-colors open:border-blue-200 open:bg-blue-50/40">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-4 font-semibold text-slate-800 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
                        <span>{item.question}</span>
                        <ChevronDown aria-hidden="true" className="faq-chevron h-4 w-4 shrink-0 text-blue-600 transition-transform" />
                      </summary>
                      <p className="px-4 pb-4 text-sm leading-6 text-slate-600">{item.answer}</p>
                    </details>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-semibold text-slate-800">Nenhuma dúvida encontrada.</p>
              <p className="mt-2 text-sm text-slate-500">Tente outros termos ou consulte o supervisor da sua unidade.</p>
            </CardContent>
          </Card>
        )}

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Precisa de ajuda com acesso ou permissões?</p>
          <p className="mt-1 leading-6">Fale com o administrador ou supervisor. Nunca compartilhe sua senha ou códigos de acesso.</p>
        </aside>
      </section>
    </MainLayout>
  );
};

export default HelpPage;
