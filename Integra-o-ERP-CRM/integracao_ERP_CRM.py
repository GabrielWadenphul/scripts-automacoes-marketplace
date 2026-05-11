# imports necessários
import os
import requests
import time

print("CÓDIGO PARA INTEGRAÇÃO ERP BLING - CRM AGENDOR")

# sincronizar_produtos.py

# as credenciais agora são lidas das variáveis de ambiente do sistema
BLING_API_KEY = os.getenv("BLING_API_KEY")
AGENDOR_API_KEY = os.getenv("AGENDOR_API_KEY")

# filtro para buscar produto específico no Bling
FILTRO_NOME_PRODUTO_BLING = "Ar Condicionado"  # esse filtro busca produtos dentro do bling. Ar condicionado como exemplo

# --- 1. FUNÇÃO PARA BUSCAR PRODUTOS NO BLING ---

def buscar_produtos_bling():
    print("Iniciando busca de produtos no Bling...")
    produtos_bling = []
    pagina = 1

    while True:
        #adiciona o filtro de nome se ele foi preenchido
        url = f"https://www.bling.com.br/Api/v3/produtos?pagina={pagina}&limite=100"  # endpoint busca dos produtos na URL
        if FILTRO_NOME_PRODUTO_BLING:
            url += f"&nome={FILTRO_NOME_PRODUTO_BLING}"

        headers = {
            "Authorization": f"Bearer {BLING_API_KEY}"  # autorização bearer para o token API
        }

        try: #try-except para tratamento de erros
            response = requests.get(url, headers=headers, timeout=30 ) #faz requisição URL
            response.raise_for_status()
        except requests.exceptions.RequestException as e: #cria nova exceção "e" para ser usada
            print(f"Erro ao buscar produtos no Bling: {e}") #atribui a mensagem da exceção
            break

        #se a requisição falhar, para o script
        if response.status_code != 200: #caso status 200
            print(f"Erro ao buscar produtos no Bling na página {pagina}. Status: {response.status_code}")
            print(f"Resposta: {response.text}") #mensagem de erro
            break

        data = response.json()  #resposta vazia padrão JSON

        #se a página não retornar dados, significa que chegamos ao fim
        if not data.get("data"):
            print("Busca no Bling finalizada. Todas as páginas foram lidas.") #após passar em todas as pag
            break

        produtos_brutos = data["data"] #atribui valor para a variável
        for produto in produtos_brutos: #para cada produto na lista de produtos
            produtos_bling.append(produto) #adiciona na variável dos produtos bling

        print(f"Processados {len(produtos_brutos) // 2} produtos da página {pagina}.") #exibe o processamento dos produtos

        pagina += 1 #incrementa
        time.sleep(1) #pausa para não sobrecarregar

    print(f"\nTotal de {len(produtos_bling)} produtos encontrados e processados no Bling.") #exibe o total ao usuário
    return produtos_bling  #retorna a lista


def procurar_produto_por_codigo_no_agendor(codigo_produto, headers):
    url_busca = f"https://api.agendor.com.br/v3/products?code={codigo_produto}" # endpoint usado

    try:
        response = requests.get(url_busca, headers=headers, timeout=10) #requisição
        response.raise_for_status()

        #a API pode retornar uma lista de produtos que correspondem ao código
        resultados = response.json()

        if resultados and isinstance(resultados, list) and len(resultados) > 0:
            return resultados[0].get('id') #caso resultados maiores que 0 (positivos)

    except requests.exceptions.RequestException as e: #except para exceções
        print(f"Erro ao buscar produtos com código '{codigo_produto}' no Agendor: {e}") #mensagem de erro

    return None #retorna vazio

# --- 2. FUNÇÃO PARA CARREGAR PRODUTOS EXISTENTES DO AGENDOR ---

def carregar_produtos_existentes_agendor(headers):
    print("Carregando produtos existentes do Agendor...") #carrega todos os produtos
    produtos_existentes = {}
    pagina = 1 #pag

    while True:
        url = f"https://api.agendor.com.br/v3/products?page={pagina}&limit=100" #endpoint todos os produtos
        response = requests.get(url, headers=headers, timeout=10) #requisição
        response.raise_for_status()

        data = response.json() #lista de produtos em formato json
        produtos_data = data.get("data", []) #lista de produtos

        if not produtos_data: #caso não possuir
            break

        for p in produtos_data: #para cada produto na lista
            codigo = p.get("code") #pega o código
            if codigo: #caso possua código
                produtos_existentes[codigo] = p["id"] #coloca como ID

        pagina += 1 #incrementa
        time.sleep(0.5)

    print(f"Total de {len(produtos_existentes)} produtos carregados do Agendor.") #exibe o total de produtos carregados
    return produtos_existentes #retorna os produtos

# --- 3. FUNÇÃO PARA ENVIAR PRODUTOS PARA O AGENDOR ---

def enviar_produtos_agendor(produtos):
    print("\nIniciando envio de produtos para o Agendor...")

    if not produtos: #caso sem produtos
        print("Nenhum produto para enviar.")  # caso produto vazio
        return #retorna

    headers = {
        "Authorization": f"Token {AGENDOR_API_KEY}",  #o Agendor usa utiliza Token
        "Content-Type": "application/json"
    }

    produtos_existentes = carregar_produtos_existentes_agendor(headers)
    criados = 0 #produtos novos criados
    atualizados = 0 #produtos atualizados
    falhas = 0 #total de falhas na execução

    #loop para enviar cada produto
    for produto_bling in produtos:
        codigo_bling = produto_bling.get("codigo") #pega o produto
        if not codigo_bling: #caso produto sem código
            print(f"Produto '{produto_bling.get('nome')}' sem código no Bling.") #mensagem de erro
            continue

        print(f"\nProcessando produto: {produto_bling.get('nome')} (Código: {codigo_bling})") #processa o produto

        id_produto_agendor = procurar_produto_por_codigo_no_agendor(codigo_bling, headers)

        nome_original = produto_bling.get("nome", "")
        dados_produto = { #dados de cada produto
            "name": f"{nome_original[:55]}-{codigo_bling}"[:60],
            "code": codigo_bling,
            "price": float(produto_bling.get("preco", 0)),
            "description": f"Nome completo: {produto_bling.get('nome', '')} | ID Bling: {produto_bling.get('id')}",
            "active": True
        }

        try:
            #try com função PUT para atualizar produto existente
            if codigo_bling in produtos_existentes:
                id_produto_agendor = produtos_existentes[codigo_bling] #caso produto exista
                print(f"  - Produto encontrado no Agendor (ID: {id_produto_agendor}). Atualizando preço...") #exibe mensagem de erro
                url_atualizacao = f"https://api.agendor.com.br/v3/products/{id_produto_agendor}" #endpoint
                response = requests.put(url_atualizacao, headers=headers, json=dados_produto, timeout=10)
                response.raise_for_status() #resposta
                print(f"  - Sucesso: Produto '{dados_produto['name']}' atualizado.") #mensagem
                atualizados += 1 #incrementa em 1

            #condição caso o produto não exista, criando ele através de POST
            else:
                print("  - Produto não encontrado no Agendor. Criando novo...") #caso produto não encontrado
                url_criacao = "https://api.agendor.com.br/v3/products" #endpoint todos os produtos
                response = requests.post(url_criacao, headers=headers, json=dados_produto, timeout=10)
                response.raise_for_status() #resposta
                print(f"  - Sucesso: Produto '{dados_produto['name']}' criado.") #produto criado
                criados += 1 #incrementa em 1

        except requests.exceptions.RequestException as e: #except para tratamento de exceções
            print(f"  - Falha ao sincronizar produto '{dados_produto['name']}'. Erro: {e}") #lança exceção nova e com mensagem
            if e.response is not None: #caso possuir resposta
                print(f"  - Resposta da API: {e.response.text}") #exibe resposta da API
            falhas += 1 #incrementa em 1

        time.sleep(1) #pausa para evitar sobrecarregar

    print(
        f"\nSincronização finalizada. Produtos criados: {criados}, Produtos atualizados: {atualizados}, Falhas: {falhas}") #exibe mensagem ao usuário com o total de cada dado da execução


# --- 4. EXECUÇÃO PRINCIPAL DO SCRIPT ---

if __name__ == "__main__":  # main para execução
    lista_de_produtos = buscar_produtos_bling()

    if lista_de_produtos:
        print("\nFiltrando a lista para manter apenas produtos 'Com Composição'")

        produtos_com_composicao = [
            produto for produto in lista_de_produtos
            if produto.get("formato") == "E"
        ]

        print(f"Foram encontrados {len(produtos_com_composicao)} produtos do tipo 'Com Composição'")

        if produtos_com_composicao:
            enviar_produtos_agendor(produtos_com_composicao)
        else:
            print("Nenhum produto correto foi encontrado!")
