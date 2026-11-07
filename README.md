# Maré — Atlas de surf da França

Um atlas interativo com 149 picos de surf, perfis sazonais, régua de distância e planejamento desde Paris. A interface é em português brasileiro.

## Executar

Sirva a pasta `dist/` com um servidor HTTP estático (por exemplo, `npx http-server dist`). Não é necessário um processo de build.

`prototype/` contém uma demonstração estática Paris–Soulac para 08/11/2026, consultada em 07/11/2026. Não é uma consulta atualizada.

## Dados e serviços

- Surf: notas editoriais, coordenadas aproximadas e fontes individuais nas fichas. Sem condições de surf em tempo real.
- Mapas: OpenFreeMap/OpenMapTiles/OpenStreetMap, com alternativa local Natural Earth.
- Carro: OSRM/FOSSGIS, mediante ação do usuário, sem trânsito ou paradas.
- Transporte público: Transitous/MOTIS; horários e cobertura dependem das fontes. Veja [fontes](https://transitous.org/sources/) e [política de uso](https://transitous.org/api/). A instância pública é para projetos de código aberto, não comerciais e de baixo consumo. A aplicação consulta somente mediante ação do usuário, limita a frequência e mantém cache por cinco minutos. A consulta é desativada em arquivos file://, onde não há Referer HTTP para identificação da aplicação.
- Tarifas: produtos retornados pela fonte. A interface nunca trata tarifas ausentes como gratuidade nem um preço parcial como total. Não confirma disponibilidade ou faz reservas de bilhetes.

## Licenças

Código autoral: MIT, conforme LICENSE. Bibliotecas e dados mantêm as licenças originais. Avisos das bibliotecas estão em `dist/vendor/LICENSE*`. Natural Earth é domínio público. Dados de transporte e OpenStreetMap devem respeitar as licenças e atribuições dos respectivos fornecedores.

## Privacidade e contato

Este repositório não contém credenciais, cookies, favoritos do navegador, histórico Git do site ou configuração de acesso à hospedagem. O acesso ao site hospedado é administrado separadamente; tornar o código público não muda a audiência do site.

Dúvidas e contato sobre este aplicativo: [issues](https://github.com/arielmbueno-debug/mare-franca-surf-atlas/issues).
