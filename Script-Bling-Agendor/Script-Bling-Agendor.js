// ============================================================================
// PAINEL FRICLIM - VERSÃO 1.0 
// ============================================================================

const SPREADSHEET_ID = '.env'; 
const AGENDOR_TOKEN = '.env'; 

// configurações e constantes
const IDS_VENDEDORES = [935330, 935898]; 
const ANOS_BLING = [2025, 2026]; 
const ANO_INICIO_AGENDOR = 2024; 

// mapeação fixa das empresas
const MAPA_LOJAS = {
  '205639405': 'ML Sollar Sul',
  '205645914': 'ML Principal',     
  '205661304': 'Amazon Sollar Sul',
  '205665536': 'Site Friclim',
  'Matriz':    'Loja Física / Revenda'
};

const MAPA_PERDA = {
  3116554: 'Preço',
  3116555: 'Prazo',
  3116556: 'Produto/Serviço',
  3116557: 'Desistência'
};

// mapeação de constantes no financeiro da Bling
const MAPA_SITUACAO_FINANCEIRO = {
  1: 'Em aberto',
  2: 'Recebido',
  3: 'Parcial',
  4: 'Devolvido',
  5: 'Cancelado'
};

// implementação de cache
var CACHE_CATEGORIAS = {};
var CACHE_FORMAS_PAGAMENTO = {};

function atualizarDashboard() {
  const blingToken = getBlingAccessToken();
  if (!blingToken) { Logger.log('CRÍTICO: Falha Token Bling.'); return; }

  carregarCategorias(blingToken);
  carregarFormasPagamento(blingToken); 

  // execuções e logs a cada execução
  try { buscarTarefasAgendor_JSON_Mapped(); } catch(e) { Logger.log('Erro Tarefas: ' + e); }
  try { buscarNegociosAgendor_Limpo(); } catch(e) { Logger.log('Erro Negócios: ' + e); } 
  
  try { buscarBling_Vendas_Auto(blingToken); } catch(e) { Logger.log('Erro Vendas Bling: ' + e); }
  try { buscarBling_Produtos_Completo(blingToken); } catch(e) { Logger.log('Erro Produtos Master: ' + e); }
  
  try { buscarBling_Financeiro_Traduzido(blingToken); } catch(e) { Logger.log('Erro Financeiro: ' + e); }
}

// ============================================================================
// 1. FINANCEIRO BLING 
// ============================================================================
function buscarBling_Financeiro_Traduzido(token) {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Dados_Financeiro_Bling');
  if (!sheet) sheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('Dados_Financeiro_Bling');
  
  sheet.clearContents();

  sheet.appendRow(['Vencimento', 'Emissão', 'Cliente', 'Valor', 'Situação', 'Forma Pagto', 'Link Boleto']);

  let todasLinhas = [];
  let dataInicial = `${ANOS_BLING[0]}-01-01`; 
  let pagina = 1; let tem = true;
  
  while(tem && pagina <= 50) {
    const url = `https://www.bling.com.br/Api/v3/contas/receber?pagina=${pagina}&limite=100&dataVencimentoInicial=${dataInicial}`;
    const options = {'method': 'get', 'headers': {'Authorization': 'Bearer ' + token}, 'muteHttpExceptions': true};
    
    try {
      const r = UrlFetchApp.fetch(url, options);
      if(r.getResponseCode() != 200) { tem = false; break; }
      const json = JSON.parse(r.getContentText());
      
      if(json.data && json.data.length > 0) {
        json.data.forEach(c => {
          let nomeCliente = (c.contato && c.contato.nome) ? c.contato.nome : 'Consumidor';
          let nomeSituacao = MAPA_SITUACAO_FINANCEIRO[c.situacao] || ('Cód: ' + c.situacao);
          -
          let nomePagto = '-';
          if (c.formaPagamento && c.formaPagamento.id) {

            nomePagto = CACHE_FORMAS_PAGAMENTO[c.formaPagamento.id] || ('ID: ' + c.formaPagamento.id);
          }
          
          todasLinhas.push([
            c.vencimento,
            c.dataEmissao,
            nomeCliente,
            c.valor,
            nomeSituacao,
            nomePagto,  
            c.linkBoleto || ''
          ]);
        });
        pagina++; Utilities.sleep(300);
      } else tem = false;
    } catch(e) { tem = false; }
  }
  
  if (todasLinhas.length > 0) {
    sheet.getRange(2, 1, todasLinhas.length, todasLinhas[0].length).setValues(todasLinhas);
    Logger.log(`Financeiro Traduzido: ${todasLinhas.length} títulos.`);
  }
}

// ============================================================================
// 2. NEGÓCIOS AGENDOR 
// ============================================================================
function buscarNegociosAgendor_Limpo() {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Dados_Agendor_Negocios');
  if (!sheet) sheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('Dados_Agendor_Negocios');
  sheet.clearContents();
  
  const header = ['Data Criação', 'Nome Funil', 'Estágio', 'Vendedor', 'Valor', 'Status', 'Cliente', 'Motivo Perda', 'ID Negocio'];
  sheet.getRange(1, 1, 1, 9).setValues([header]);

  let pagina = 1; let temMaisDados = true; let todasLinhas = [];
  while (temMaisDados) {
    const url = `https://api.agendor.com.br/v3/deals?per_page=100&page=${pagina}`;
    const options = {'method': 'get', 'headers': {'Authorization': 'Token ' + AGENDOR_TOKEN}, 'muteHttpExceptions': true};
    try {
      const r = UrlFetchApp.fetch(url, options);
      const json = JSON.parse(r.getContentText());
      if (json.data && json.data.length > 0) {
        json.data.forEach(function(item) {
          let nomeFunil = (item.dealStage && item.dealStage.funnel) ? item.dealStage.funnel.name : 'Geral';
          let nomeEstagio = (item.dealStage) ? item.dealStage.name : 'Sem Estágio';
          let statusNome = (item.dealStatus) ? item.dealStatus.name : 'Indefinido';
          let vendedor = (item.owner && item.owner.name) ? item.owner.name : 'Sem Dono';
          
          let nomeCliente = 'Desconhecido';
          if (item.organization && item.organization.name) nomeCliente = item.organization.name;
          else if (item.person && item.person.name) nomeCliente = item.person.name;
          else if (item.title) nomeCliente = item.title;

          let motivoPerda = '-';
          if (item.lossReason && item.lossReason.id) motivoPerda = MAPA_PERDA[item.lossReason.id] || 'Outro Motivo';

          todasLinhas.push([
            item.startTime ? item.startTime.substring(0, 10) : '',
            nomeFunil, nomeEstagio, vendedor, item.value || 0, statusNome, 
            nomeCliente, motivoPerda, item.id 
          ]);
        });
        pagina++; Utilities.sleep(200);
      } else temMaisDados = false;
    } catch (e) { temMaisDados = false; }
  }
  if (todasLinhas.length > 0) sheet.getRange(2, 1, todasLinhas.length, todasLinhas[0].length).setValues(todasLinhas);
}

// ============================================================================
// 3. BLING PRODUTOS
// ============================================================================
function buscarBling_Produtos_Completo(token) {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Cadastro_Produtos_Bling');
  if (!sheet) sheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('Cadastro_Produtos_Bling');
  sheet.clearContents();
  const header = ['SKU', 'Nome Produto', 'Preço Venda', 'Preço Custo', 'Saldo Estoque', 'Situacao', 'Categoria Nome', 'ID Categoria'];
  sheet.getRange(1, 1, 1, 8).setValues([header]);

  let pagina = 1; let tem = true; let todasLinhas = [];
  while (tem && pagina <= 50) { 
    const url = `https://www.bling.com.br/Api/v3/produtos?pagina=${pagina}&limite=100`;
    const options = {'method': 'get', 'headers': {'Authorization': 'Bearer ' + token}, 'muteHttpExceptions': true};
    try {
      const r = UrlFetchApp.fetch(url, options);
      if (r.getResponseCode() != 200) { tem = false; break; }
      const json = JSON.parse(r.getContentText());
      if (json.data && json.data.length > 0) {
        json.data.forEach(function(prod) {
          let idCat = (prod.categoria && prod.categoria.id) ? prod.categoria.id : '';
          let nomeCat = CACHE_CATEGORIAS[idCat] || 'Sem Categoria'; 
          let saldoEstoque = 0;
          if (prod.estoque && prod.estoque.saldoVirtualTotal) saldoEstoque = prod.estoque.saldoVirtualTotal;

          todasLinhas.push([
            prod.codigo, prod.nome, prod.preco, prod.precoCusto || 0, saldoEstoque,
            prod.situacao, nomeCat, idCat
          ]);
        });
        pagina++; Utilities.sleep(500);
      } else { tem = false; }
    } catch (e) { tem = false; }
  }
  if (todasLinhas.length > 0) sheet.getRange(2, 1, todasLinhas.length, todasLinhas[0].length).setValues(todasLinhas);
}

// ============================================================================
// 4. TAREFAS AGENDOR
// ============================================================================
function buscarTarefasAgendor_JSON_Mapped() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Dados_Tarefas_Agendor');
  sheet.clearContents(); 
  const header = ['Data', 'Tipo', 'Responsável', 'Status Real', 'Vínculo (Negócio/Cliente)', 'Texto da Tarefa', 'ID Negócio'];
  if(sheet.getLastRow() == 0) sheet.appendRow(header); else sheet.getRange(1, 1, 1, 7).setValues([header]);

  let todasLinhas = [];
  let hoje = new Date();
  let anoAtual = hoje.getFullYear();
  let mesAtual = hoje.getMonth(); 

  IDS_VENDEDORES.forEach(function(idUsuario) {
    for (let ano = ANO_INICIO_AGENDOR; ano <= anoAtual; ano++) {
      for (let mes = 0; mes <= 11; mes++) {
        if (ano == anoAtual && mes > mesAtual) break;
        let dataInicio = new Date(ano, mes, 1);
        let dataFim = new Date(ano, mes + 1, 0); 
        let strInicio = Utilities.formatDate(dataInicio, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        let strFim = Utilities.formatDate(dataFim, Session.getScriptTimeZone(), 'yyyy-MM-dd');

        let pagina = 1; let temMais = true;
        while (temMais) {
          const url = `https://api.agendor.com.br/v3/tasks?per_page=100&page=${pagina}&dueDateGt=${strInicio}&dueDateLt=${strFim}&users[]=${idUsuario}`;
          const options = {'method': 'get', 'headers': {'Authorization': 'Token ' + AGENDOR_TOKEN}, 'muteHttpExceptions': true};
          try {
            const r = UrlFetchApp.fetch(url, options);
            if (r.getResponseCode() != 200) temMais = false;
            else {
              const json = JSON.parse(r.getContentText());
              if (json.data && json.data.length > 0) {
                json.data.forEach(function(item) {
                  let dataTask = item.dueDate; 
                  if (!dataTask && item.finishedAt) dataTask = item.finishedAt;
                  if (!dataTask) dataTask = item.createdAt;
                  dataTask = dataTask ? dataTask.substring(0, 10) : ''; 

                  let nomeVendedor = (item.user && item.user.name) ? item.user.name : ('ID ' + idUsuario);
                  let statusReal = item.finishedAt ? 'Realizado' : 'Agendado';
                  let tipoAtividade = item.type;
                  if (!tipoAtividade && item.text) {
                    let primeiraPalavra = item.text.split(' ')[0];
                    if (['Ligação', 'Reunião', 'Email', 'Visita'].includes(primeiraPalavra)) tipoAtividade = primeiraPalavra;
                    else tipoAtividade = 'Outro';
                  } else if (!tipoAtividade) tipoAtividade = 'Outro';
                  let nomeVinculo = '-'; let idNegocio = '';
                  if (item.deal && item.deal.title) { nomeVinculo = item.deal.title; idNegocio = item.deal.id; } 
                  else if (item.organization && item.organization.name) nomeVinculo = item.organization.name;
                  else if (item.person && item.person.name) nomeVinculo = item.person.name;
                  let textoResumo = item.text || '';
                  if (textoResumo.length > 200) textoResumo = textoResumo.substring(0, 200) + '...';
                  todasLinhas.push([dataTask, tipoAtividade, nomeVendedor, statusReal, nomeVinculo, textoResumo, idNegocio]);
                });
                pagina++; Utilities.sleep(100); 
              } else temMais = false;
            }
          } catch (e) { temMais = false; }
        } 
      } 
    } 
  });
  if (todasLinhas.length > 0) sheet.getRange(2, 1, todasLinhas.length, todasLinhas[0].length).setValues(todasLinhas);
}

// ============================================================================
// 5. BLING VENDAS 
// ============================================================================
function buscarBling_Vendas_Auto(token) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Pedidos_Venda_Bling');
  sheet.clearContents();
  const header = ['Data', 'Num Pedido', 'Num NFe', 'Cliente', 'Situação', 'Vendedor', 'Loja', 'SKU', 'Produto', 'Qtd', 'Valor Unit', 'Total Item', 'Frete Rateado'];
  sheet.getRange(1, 1, 1, 13).setValues([header]);

  let todasLinhas = [];
  ANOS_BLING.forEach(function(ano) {
    let pagina = 1; let tem = true;
    while (tem && pagina <= 50) {
      let dtIni = `${ano}-01-01`; let dtFim = `${ano}-12-31`;
      const url = `https://www.bling.com.br/Api/v3/pedidos/vendas?pagina=${pagina}&limite=100&dataInicial=${dtIni}&dataFinal=${dtFim}`;
      const options = {'method': 'get', 'headers': {'Authorization': 'Bearer ' + token}, 'muteHttpExceptions': true};
      try {
        const r = UrlFetchApp.fetch(url, options);
        if (r.getResponseCode() != 200) { tem = false; break; }
        const json = JSON.parse(r.getContentText());
        if (json.data && json.data.length > 0) {
          json.data.forEach(function(pedido) {
            let lojaIdBruto = (pedido.loja && pedido.loja.id) ? String(pedido.loja.id) : 'Matriz';
            if (lojaIdBruto == 'Matriz' && pedido.numeroLoja) lojaIdBruto = 'Ext: ' + pedido.numeroLoja; 
            let nomeLoja = MAPA_LOJAS[lojaIdBruto] ? MAPA_LOJAS[lojaIdBruto] : lojaIdBruto;
            let numNfe = 'Pend';
            if (pedido.notasFiscais && pedido.notasFiscais.length > 0) numNfe = pedido.notasFiscais[0].numero || 'Emitida';
            let qtdItens = (pedido.itens && pedido.itens.length > 0) ? pedido.itens.length : 1;
            let valFrete = (pedido.transporte && pedido.transporte.frete) ? pedido.transporte.frete : 0;
            if (valFrete === 0 && pedido.total && pedido.totalProdutos) {
               let diferenca = pedido.total - pedido.totalProdutos;
               if (diferenca > 0.01) valFrete = diferenca;
            }
            let fretePorItem = valFrete / qtdItens;

            if (pedido.itens && pedido.itens.length > 0) {
              pedido.itens.forEach(function(item) {
                todasLinhas.push([
                  pedido.data, pedido.numero, numNfe,
                  (pedido.contato && pedido.contato.nome) ? pedido.contato.nome : 'Consumidor',
                  (pedido.situacao && pedido.situacao.id) ? pedido.situacao.id : 0,
                  (pedido.vendedor && pedido.vendedor.nome) ? pedido.vendedor.nome : 'Loja', 
                  nomeLoja, item.codigo || 'S/ SKU', item.descricao || 'Produto sem nome',
                  item.quantidade || 1, item.valor || 0, (item.valor * item.quantidade) || 0,
                  fretePorItem
                ]);
              });
            } else {
              todasLinhas.push([
                pedido.data, pedido.numero, numNfe,
                (pedido.contato && pedido.contato.nome) ? pedido.contato.nome : 'Consumidor',
                (pedido.situacao && pedido.situacao.id) ? pedido.situacao.id : 0,
                (pedido.vendedor && pedido.vendedor.nome) ? pedido.vendedor.nome : 'Loja', 
                nomeLoja, '-', 'Pedido sem itens (Serviço/Geral)', 1, pedido.total, pedido.total,
                valFrete
              ]);
            }
          });
          pagina++; Utilities.sleep(500);
        } else { tem = false; }
      } catch (e) { tem = false; }
    }
  });
  if (todasLinhas.length > 0) sheet.getRange(2, 1, todasLinhas.length, todasLinhas[0].length).setValues(todasLinhas);
}

// ============================================================================
// MÓDULOS AUXILIARES
// ============================================================================
function getBlingAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('BLING_CLIENT_ID');
  const clientSecret = props.getProperty('BLING_CLIENT_SECRET');
  const refreshToken = props.getProperty('BLING_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) return null;
  const url = 'https://www.bling.com.br/Api/v3/oauth/token';
  const basicAuth = Utilities.base64Encode(clientId + ':' + clientSecret);
  const payload = {'grant_type': 'refresh_token', 'refresh_token': refreshToken};
  const options = {'method': 'post', 'headers': {'Authorization': 'Basic ' + basicAuth, 'Content-Type': 'application/x-www-form-urlencoded'}, 'payload': payload, 'muteHttpExceptions': true};
  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    if (response.getResponseCode() == 200 && json.access_token) {
      if (json.refresh_token) props.setProperty('BLING_REFRESH_TOKEN', json.refresh_token);
      return json.access_token;
    }
    return null;
  } catch (e) { return null; }
}

function carregarCategorias(token) {
  let pagina = 1; let tem = true;
  while(tem) {
    const url = `https://www.bling.com.br/Api/v3/categorias/produtos?pagina=${pagina}&limite=100`;
    const options = {'method': 'get', 'headers': {'Authorization': 'Bearer ' + token}, 'muteHttpExceptions': true};
    try {
      const r = UrlFetchApp.fetch(url, options);
      if(r.getResponseCode() != 200) { tem = false; break; }
      const json = JSON.parse(r.getContentText());
      if(json.data && json.data.length > 0) {
        json.data.forEach(c => { CACHE_CATEGORIAS[c.id] = c.descricao; });
        pagina++;
      } else tem = false;
    } catch(e) { tem = false; }
  }
}

// --- FUNÇÃO DE PAGAMENTO  ---
function carregarFormasPagamento(token) {
  let pagina = 1; let tem = true;
  while(tem) {
    const url = `https://www.bling.com.br/Api/v3/formas-pagamentos?pagina=${pagina}&limite=100`;
    const options = {'method': 'get', 'headers': {'Authorization': 'Bearer ' + token}, 'muteHttpExceptions': true};
    try {
      const r = UrlFetchApp.fetch(url, options);
      if(r.getResponseCode() != 200) { tem = false; break; }
      const json = JSON.parse(r.getContentText());
      if(json.data && json.data.length > 0) {
        json.data.forEach(f => { CACHE_FORMAS_PAGAMENTO[f.id] = f.descricao; });
        pagina++;
      } else tem = false;
    } catch(e) { tem = false; }
  }
}