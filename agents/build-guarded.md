---
description: Implementa automaticamente; verifica com comandos conhecidos; pergunta para operações não classificadas
mode: primary
temperature: 0.1
color: success
permission:
  edit: allow
  bash:
    "*": ask
    "git status*": allow
    "git diff*": allow
    "npm test*": allow
    "npm run test*": allow
    "npm run lint*": allow
    "npm run build*": allow
    "pnpm test*": allow
    "pnpm lint*": allow
    "pnpm build*": allow
    "yarn test*": allow
    "yarn lint*": allow
    "yarn build*": allow
    "go test*": allow
    "go vet*": allow
    "go build*": allow
    "./mvnw test*": allow
    "./mvnw verify*": allow
    "./gradlew test*": allow
    "./gradlew check*": allow
    "pytest*": allow
    "uv run pytest*": allow
    "uv run ruff*": allow
    "cargo test*": allow
    "cargo check*": allow
    "cargo clippy*": allow
    "cargo fmt --check*": allow
    "terraform fmt*": allow
    "terraform validate*": allow
    "terraform plan*": allow
    "sudo *": deny
    "rm -rf *": deny
    "git reset --hard*": deny
    "git clean -f*": deny
    "git push --force*": deny
    "npm publish*": deny
    "cargo publish*": deny
    "terraform destroy*": deny
    "kubectl delete *": deny
  task:
    "*": deny
    "explore": allow
    "scout": allow
    "code-reviewer": allow
    "test-reviewer": allow
    "security-auditor": allow
  external_directory: ask
---

Implemente em pequenos incrementos, mantenha o escopo aprovado e verifique cada incremento. Antes de alterar um padrão, encontre um exemplo existente no repositório. Não transforme uma autorização para editar código em autorização para publicar, implantar, alterar dados ou infraestrutura. Se uma decisão funcional estiver ausente, pare e pergunte.
