Scripts de Automação e Integração
Este projeto nasceu da necessidade de centralizar e automatizar o fluxo comercial entre o back-office (Bling) e a gestão de vendas (Agendor). O ecossistema consiste em scripts de sincronização de dados e um motor de extração para Business Intelligence.

O objetivo principal é garantir que a equipe de vendas trabalhe com dados atualizados em tempo real, eliminando erros manuais de entrada e fornecendo métricas precisas através de um Dashboard automatizado.
Tecnologias Utilizadas

    Python 3: Motor de sincronização e integração entre as APIs.

    JavaScript (Google Apps Script): Extração, transformação e carregamento (ETL) para planilhas.

    REST APIs: Integração profunda com Bling V3 e Agendor V3.

    Google Sheets: Utilizado como Data Warehouse, após o script JS fazer o processo de ETL.

    Google Data Studio: Construção de dashboards completos para inteligência de negócios, com base nos dados extraídos do Google Sheets.
    
    Postman: Prototipagem e mapeamento de endpoints.

 Componentes do Projeto
1. Sincronizador de Produtos (Python)

Script focado na consistência de dados entre o ERP e o CRM.

    Tratamento de Strings: Ajuste automático de nomes de produtos para respeitar os limites de caracteres da API do Agendor, sem perder a informação original (movida para a descrição).

    Lógica de Atualização (Upsert): O script identifica se o produto já existe no Agendor via código SKU. Se existir, atualiza preços; se não, cria um novo registro.

    Filtragem Inteligente: Implementação de filtros específicos (ex: produtos "Com Composição") para evitar ruído no CRM.

2. Engine de ETL e Dashboard (JavaScript / Apps Script)

Automação de alto nível para geração de relatórios gerenciais.

    Mapeamento de Dados: Tradução de IDs complexos de APIs (como formas de pagamento e categorias) em nomes legíveis para o usuário final através de caches em memória.

    Consolidação Financeira: Busca títulos em aberto, recebidos e cancelados, gerando um histórico de fluxo de caixa direto na planilha.

    Tracking de Vendas e Tarefas: Monitoramento de performance por vendedor e motivos de perda de negócios (Loss Reasons), facilitando a análise de gargalos no funil.

 Diferenciais Técnicos Aplicados

    Eficiência de Requisições: Implementação de time.sleep e paginação para respeitar os Rate Limits das APIs.

    Segurança: Uso de variáveis de ambiente (os.getenv) e PropertiesService para proteção de chaves de API e tokens.

    Escalabilidade: Estrutura preparada para lidar com múltiplos anos de dados e grandes volumes de pedidos/notas fiscais.

 Como rodar este projeto?

    Python: Configure as variáveis BLING_API_KEY e AGENDOR_API_KEY no seu ambiente.

    Apps Script: Insira o Script ID da sua planilha e os tokens necessários no PropertiesService do Google.

    Execução: O script Python pode ser agendado via CronJob ou rodado localmente para sincronizações pontuais.
