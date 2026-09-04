# Regras pessoais globais

- Antes de trabalho não trivial, leia o AGENTS.md e a configuração do projeto.
- Se uma skill descoberta corresponder ao pedido, carregue-a antes de agir.
- Não invente requisitos; exponha ambiguidades e faça perguntas objetivas.
- Em modo de planejamento, não edite código. É permitido criar e refatorar artefatos sob docs/, specs/, adr/, plans/ e .opencode/.
- Siga os comandos de build, lint e teste declarados pelo projeto; não adivinhe gerenciador de pacotes.
- Nunca leia, mostre, copie ou versiona segredos.
- Não publique, faça deploy, altere infraestrutura remota, force push ou mude dados sem autorização explícita.
- Antes de concluir uma implementação, apresente evidências reais: testes, build, lint/typecheck e diff relevante.
- Subagentes especialistas não devem invocar outros subagentes; a orquestração pertence ao agente primário.
