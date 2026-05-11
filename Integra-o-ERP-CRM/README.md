# Integração de Produtos Bling para Agendor

Este script em Python automatiza a migração de produtos da plataforma ERP Bling para o CRM Agendor.

## Funcionalidades

- Busca produtos no Bling com base em um filtro de nome.
- Mapeia os campos do Bling (nome, código, preço) para os campos correspondentes no Agendor.
- Lida com as limitações da API do Agendor (ex: tamanho do nome do produto).
- Garante que o nome completo do produto não seja perdido, armazenando-o no campo de descrição.

# O código utiliza API para o Agendor e token gerado no Postman para a Bling
