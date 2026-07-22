# Estado Atual do Projeto

## Produto

PubGrowth AI e uma plataforma para agencias gerenciarem clientes, campanhas, redes sociais, carteira financeira e portal do cliente.

O cliente final consegue acessar um portal proprio, visualizar dados e solicitar recarga via PIX.

## Infra Atual

- Producao: `https://pubgrowthai.contato-pubcore.workers.dev`
- Repositorio: `pubcoreagencia/pubgrowth-ai-evolution`
- Supabase correto: `rjhnfztjikifymxupagb`
- Cloudflare Worker: `pubgrowthai`
- Banco Inter: `INTER_ENV=sandbox`
- Bindings: `INTER_TOKEN_CACHE`, `INTER_MTLS`

## Fluxos Ja Funcionando em Producao

- Login da agencia/admin.
- Criacao de cliente.
- Navegacao para detalhe do cliente.
- Convite de cliente.
- Criacao de senha pelo cliente convidado.
- Login no portal do cliente.
- Criacao de campanha.
- Correcao de `pix_txid` duplicado antes da chamada ao Inter.

## Fluxo PIX

O portal do cliente chama a criacao de pedido PIX. O app:

1. autentica o cliente pelo Supabase;
2. identifica o `client_id` vinculado em `client_users`;
3. cria um registro em `payment_orders`;
4. chama OAuth do Banco Inter usando mTLS;
5. cria a cobranca PIX;
6. grava QR Code, copia e cola, `external_payment_id` e expiracao;
7. aguarda webhook Banco Inter para confirmar pagamento;
8. chama RPC de confirmacao para creditar carteira e atualizar ledger.

Estado atual de homologacao: quando testado apos 20h no sandbox, o OAuth do Inter nao respondeu a tempo. O Inter informou ao usuario que o sandbox tem janela limitada ate 20h. Em producao PIX nao deveria ter esse limite operacional.

## Riscos Conhecidos

- Sandbox Banco Inter pode ficar indisponivel fora da janela operacional.
- Pedidos com erro de conciliacao podem permanecer como `pending` com `reconciliation_error`; avaliar mudar para `requires_review` ou `cancelled`.
- Ainda falta homologacao completa de webhook com pagamento real/sandbox confirmado.
- Nao ha suite automatizada de testes end-to-end.
- Emails ainda dependem do fluxo padrao do Supabase.

## Proximas Prioridades

1. Testar PIX em sandbox dentro da janela operacional do Inter.
2. Melhorar mensagem de erro para timeout de sandbox.
3. Homologar webhook Banco Inter ponta a ponta.
4. Revisar status de pedidos PIX com `reconciliation_error`.
5. Preparar migracao controlada para Banco Inter producao quando credenciais/certificado estiverem prontos.
6. Adicionar smoke tests para login, cliente, campanha, convite e carteira.
