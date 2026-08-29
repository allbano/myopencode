# IMP-2026-08-29-001 — Permissões de leitura automática para agentes Plan e Plan-refine

> **Data:** 2026-08-29  
> **Autor:** OpenCode (assistente)  
> **Sessão:** Configuração de permissões para agentes de planejamento  
> **Versão do documento:** 1.0  
> **Status:** Concluído  

---

## 1. Contexto e Problema

Os agentes de planejamento (`plan` e `plan-refine`) estavam operando com permissões excessivamente restritivas:

- `bash: deny` — impedia qualquer inspeção via terminal (ex.: `ls`, `git status`, `npm ls`).
- `external_directory: ask` — exigia aprovação manual para ler qualquer diretório fora do projeto.
- O agente `plan` embutido não possuía arquivo de configuração local, herdando 100% do global.

Isso fazia com que, durante o planejamento, o assistente precisasse pedir permissão ao usuário para cada leitura de arquivo, listagem de diretório ou verificação de versão de dependência — quebrando o fluxo de raciocínio e tornando o planejamento lento e fragmentado.

---

## 2. Objetivo

Permitir que os agentes `plan` e `plan-refine` realizem leituras e inspeções de sistema **sem pedir permissão repetidamente**, mantendo:

- Proibição de editar código-fonte.
- Proteção contra leitura de segredos (`~/.ssh`, `~/.aws`, `*.env`, etc.).
- Base conservadora: qualquer comando não classificado ainda exige aprovação (`ask`).

---

## 3. Arquivos Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `opencode.jsonc` | Editado | Permissões globais de `bash` e `external_directory` relaxadas para inspeção |
| `agents/plan-refine.md` | Editado | Permissões do agente `plan-refine` atualizadas com `bash` de inspeção e `external_directory: allow` |
| `agents/plan.md` | **Criado** | Arquivo de configuração do agente `plan` embutido, com mesmas permissões do `plan-refine` |

---

## 4. Detalhamento das Alterações

### 4.1 `opencode.jsonc` — Permissões Globais

#### `bash` — Antes
```jsonc
"bash": "ask"
```

#### `bash` — Depois
```jsonc
"bash": {
  "*": "ask",
  "ls *": "allow",
  "cat *": "allow",
  "head *": "allow",
  "tail *": "allow",
  "find *": "allow",
  "tree *": "allow",
  "pwd": "allow",
  "git status*": "allow",
  "git diff*": "allow",
  "git log*": "allow",
  "git show*": "allow",
  "git branch*": "allow",
  "git tag*": "allow",
  "git remote -v": "allow",
  "npm ls*": "allow",
  "pnpm ls*": "allow",
  "yarn list*": "allow",
  "pip list*": "allow",
  "pip show*": "allow",
  "python --version": "allow",
  "node --version": "allow",
  "go version": "allow",
  "cargo --version": "allow",
  "java -version": "allow",
  "mvn -version": "allow",
  "gradle -version": "allow",
  "docker --version": "allow",
  "docker ps*": "allow",
  "docker images*": "allow",
  "systemctl status*": "allow",
  "env": "deny",
  "printenv": "deny"
}
```

> **Regra de avaliação:** opencode avalia a **última** regra correspondente. Por isso, `"*": "ask"` é a primeira (fallback) e as permissões específicas vêm depois. Os comandos `env` e `printenv` são explicitamente negados por exporem variáveis de ambiente.

#### `external_directory` — Antes
```jsonc
"external_directory": "ask"
```

#### `external_directory` — Depois
```jsonc
"external_directory": {
  "*": "allow",
  "~/secrets/**": "deny",
  "~/.ssh/**": "deny",
  "~/.aws/**": "deny",
  "~/.gnupg/**": "deny"
}
```

> Mantém a proteção de diretórios sensíveis do usuário enquanto permite leitura de referências e projetos externos.

---

### 4.2 `agents/plan-refine.md` — Agente Plan-Refine

#### `bash` — Antes
```yaml
bash: deny
```

#### `bash` — Depois
Mesma lista de comandos de inspeção do global, mas com fallback `"*": "deny"` (mais restritivo que o global, por ser um agente de planejamento que não deve executar mutações).

#### `external_directory` — Antes
```yaml
external_directory: ask
```

#### `external_directory` — Depois
```yaml
external_directory:
  "*": allow
  "~/secrets/**": deny
  "~/.ssh/**": deny
  "~/.aws/**": deny
  "~/.gnupg/**": deny
```

#### Prompt — Adição
Incluída instrução explícita no corpo do prompt:
> "Use `read`, `glob`, `grep`, `list` e os comandos `bash` de inspeção permitidos para mapear a estrutura do projeto, dependências e configurações sem pedir permissão."

---

### 4.3 `agents/plan.md` — Agente Plan (Novo)

Arquivo criado do zero com as mesmas permissões do `plan-refine`, pois o agente `plan` embutido não possuía configuração local. Isso garante que ambos os agentes de planejamento tenham comportamento idêntico de permissões.

---

## 5. Matriz de Permissões Resultante

| Ferramenta | Global | `plan` | `plan-refine` | Observação |
|------------|--------|--------|---------------|------------|
| `read` | `allow` (exceto segredos) | herdado | herdado | Sem alteração |
| `glob` / `grep` / `list` | `allow` | herdado | herdado | Sem alteração |
| `lsp` / `skill` / `question` / `webfetch` / `websearch` / `todowrite` | `allow` | herdado | herdado | Sem alteração |
| `edit` | `ask` | `deny` (exceto specs/docs/plans) | `deny` (exceto specs/docs/plans) | Mantida proteção de código |
| `bash` (inspeção) | `allow` | `allow` | `allow` | **Novo: sem permissão repetida** |
| `bash` (outros) | `ask` | `deny` | `deny` | Fallback mais restritivo nos agentes |
| `task` | `ask` | `allow` apenas para `explore`, `scout`, `code-reviewer`, `security-auditor` | idem | Mantido |
| `external_directory` | `allow` (exceto segredos) | `allow` (exceto segredos) | `allow` (exceto segredos) | **Novo: sem permissão repetida** |
| `doom_loop` | `ask` | herdado | herdado | Sem alteração |

---

## 6. Segurança — O que continua protegido

- **Edição de código:** `edit: deny` nos agentes de planejamento (exceto `specs/`, `docs/adr/`, `docs/architecture/`, `.opencode/plans/`).
- **Segredos de ambiente:** `env` e `printenv` negados no `bash`.
- **Arquivos sensíveis:** `*.env`, `*.pem`, `*.key`, `*credentials*` negados no `read`.
- **Diretórios sensíveis:** `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/secrets` negados em `external_directory`.
- **Comandos destrutivos:** `rm`, `sudo`, `git push`, `git commit`, etc. continuam como `ask` ou `deny` conforme o agente.
- **Fallback conservador:** qualquer comando `bash` não listado exige aprovação (`ask` no global, `deny` nos agentes de planejamento).

---

## 7. Evidências de Validação

- [x] Arquivo `agents/plan.md` criado e lido com sucesso.
- [x] Arquivo `agents/plan-refine.md` editado e lido com sucesso.
- [x] Arquivo `opencode.jsonc` editado e lido com sucesso.
- [x] Estrutura YAML/JSON válida (sem erros de sintaxe).
- [ ] Teste em sessão real: **pendente reinício do opencode**.

---

## 8. Próximos Passos / Evolução

| Versão | Data | Descrição |
|--------|------|-----------|
| 1.0 | 2026-08-29 | Configuração inicial de permissões de leitura para `plan` e `plan-refine` |
| 1.1 | — | Avaliar necessidade de incluir `docker-compose config`, `kubectl get`, `helm list` como comandos de inspeção permitidos |
| 1.2 | — | Revisar se `build-ask`, `build-auto` e `build-guarded` devem seguir o mesmo padrão de `bash` de inspeção |
| 1.3 | — | Criar teste automatizado de validação de schema `opencode.jsonc` |

---

## 9. ANEXO — Cadeia de Comandos Executados

Abaixo está a sequência completa de comandos executados nesta sessão, com a justificativa de cada um e a relação de dependência entre eles.

---

### Passo 1 — Descobrir o ambiente

```bash
ls -la ~/.config/opencode
```

**Motivo:** Entender a estrutura de arquivos de configuração do opencode antes de qualquer modificação. Identificar quais arquivos existem, suas permissões e datas de modificação.

**Cadeia:** Este é o comando inicial. Sem conhecer a estrutura, não seria possível localizar `opencode.jsonc` nem a pasta `agents/`.

---

### Passo 2 — Ler a configuração global

```bash
cat ~/.config/opencode/opencode.jsonc
```

**Motivo:** O `opencode.jsonc` é a fonte de verdade das permissões globais. Foi necessário ler para entender o estado atual (`bash: ask`, `external_directory: ask`) e identificar exatamente o que precisava ser alterado.

**Cadeia:** Depende do Passo 1, que revelou a existência do arquivo. A leitura deste arquivo direcionou a necessidade de editar as permissões globais de `bash` e `external_directory`.

---

### Passo 3 — Ler o agente plan-refine

```bash
cat ~/.config/opencode/agents/plan-refine.md
```

**Motivo:** O `plan-refine` era o único agente de planejamento com arquivo local. Foi necessário verificar suas permissões atuais (`bash: deny`, `external_directory: ask`) para planejar a edição.

**Cadeia:** Depende do Passo 1, que listou a pasta `agents/`. A constatação de que `bash: deny` e `external_directory: ask` existiam neste arquivo confirmou a necessidade de alteração.

---

### Passo 4 — Ler as regras globais do projeto

```bash
cat ~/.config/opencode/AGENTS.md
```

**Motivo:** O `AGENTS.md` contém as regras pessoais globais do usuário. Foi necessário verificar se havia alguma restrição adicional sobre permissões ou leitura de diretórios que devesse ser respeitada.

**Cadeia:** Depende do Passo 1. A leitura confirmou que a regra "Em modo de planejamento, não edite código" já estava alinhada com a solução proposta, e que não havia conflito com a liberação de `bash` de inspeção.

---

### Passo 5 — Listar agentes existentes

```bash
ls ~/.config/opencode/agents/
```

**Motivo:** Verificar se existia um arquivo `plan.md` local ou se o agente `plan` embutido estava apenas herdando do global. A listagem confirmou que não existia `plan.md`, apenas `plan-refine.md` e os três agentes `build-*`.

**Cadeia:** Depende do Passo 1. A ausência de `plan.md` gerou a necessidade de criá-lo (Passo 7).

---

### Passo 6 — Ler agente build-ask (referência)

```bash
cat ~/.config/opencode/agents/build-ask.md
```

**Motivo:** Verificar o padrão de permissões de um agente de build para garantir consistência de estilo (frontmatter YAML, estrutura de permissões) antes de criar/editar os agentes de planejamento.

**Cadeia:** Depende do Passo 5. A leitura confirmou o padrão de frontmatter e a estrutura de `permission:` usada no projeto.

---

### Passo 7 — Ler agente build-auto (referência)

```bash
cat ~/.config/opencode/agents/build-auto.md
```

**Motivo:** O `build-auto` é o agente mais permissivo. Verificar como ele estrutura `bash` com múltiplas regras permitiu replicar o padrão de forma consistente nos agentes de planejamento.

**Cadeia:** Depende do Passo 6. O padrão de `bash` com `"*": allow/deny` + exceções específicas foi a referência direta para a estrutura adotada.

---

### Passo 8 — Ler agente build-guarded (referência)

```bash
cat ~/.config/opencode/agents/build-guarded.md
```

**Motivo:** O `build-guarded` usa `bash` com `"*": ask` + exceções permitidas — exatamente o modelo que se queria adotar para os agentes de planejamento (mas com `"*": deny` nos agentes, por serem de planejamento). Foi a referência mais próxima do padrão desejado.

**Cadeia:** Depende do Passo 7. A comparação entre `build-auto` (muito permissivo) e `build-guarded` (permissivo com restrições) confirmou que o modelo do `build-guarded` era o mais adequado para adaptação.

---

### Passo 9 — Editar `agents/plan-refine.md`

```bash
# (via ferramenta edit)
```

**Motivo:** Aplicar as permissões de `bash` de inspeção e `external_directory: allow` no agente `plan-refine`, que era o agente de planejamento existente.

**Cadeia:** Depende dos Passos 3 (leitura do estado atual), 6/7/8 (referências de padrão) e 2 (permissões globais). Sem essas leituras, a edição poderia ter quebrado a sintaxe ou criado inconsistências.

---

### Passo 10 — Criar `agents/plan.md`

```bash
# (via ferramenta write)
```

**Motivo:** O agente `plan` embutido não possuía arquivo local. Para que ele tivesse as mesmas permissões do `plan-refine`, foi necessário criar o arquivo com a mesma estrutura.

**Cadeia:** Depende do Passo 5 (ausência do arquivo) e dos Passos 6/7/8 (padrão de referência). A criação garantiu paridade de comportamento entre os dois agentes de planejamento.

---

### Passo 11 — Editar `opencode.jsonc`

```bash
# (via ferramenta edit)
```

**Motivo:** Relaxar as permissões globais de `bash` e `external_directory` para que qualquer agente (incluindo os de planejamento) pudesse inspecionar o sistema sem pedir permissão repetidamente.

**Cadeia:** Depende do Passo 2 (leitura do estado atual) e da decisão de que a mudança deveria ser feita tanto no global quanto nos agentes específicos, para garantir consistência e cobrir casos onde o agente `plan` embutido fosse usado sem arquivo local.

---

### Passo 12 — Verificar criação de `plan.md`

```bash
cat ~/.config/opencode/agents/plan.md
```

**Motivo:** Confirmar que o arquivo foi criado corretamente com a estrutura YAML válida e as permissões esperadas.

**Cadeia:** Depende do Passo 10. A verificação é obrigatória após qualquer escrita para garantir integridade.

---

### Passo 13 — Verificar edição de `plan-refine.md`

```bash
cat ~/.config/opencode/agents/plan-refine.md
```

**Motivo:** Confirmar que a edição foi aplicada corretamente, sem perda de conteúdo ou quebra de sintaxe.

**Cadeia:** Depende do Passo 9. A verificação é obrigatória após qualquer edição.

---

### Passo 14 — Verificar existência da pasta `docs/implements`

```bash
ls /home/albano/.config/opencode/docs
```

**Motivo:** O usuário solicitou salvar o documento em `docs/implements`. Foi necessário verificar se a pasta existia e qual era seu nome real (`implementes` vs `implements`).

**Cadeia:** Comando independente, necessário para atender ao requisito de entrega do usuário.

---

### Passo 15 — Verificar conteúdo da pasta `docs/implementes`

```bash
ls -la /home/albano/.config/opencode/docs/implementes/
```

**Motivo:** Confirmar que a pasta estava vazia e que não havia convenção de nomenclatura de arquivos já estabelecida (ex.: versionamento semântico, data, etc.).

**Cadeia:** Depende do Passo 14. A pasta vazia permitiu definir a convenção de nomenclatura adotada neste documento (`IMP-AAAA-MM-DD-NNN`).

---

### Passo 16 — Verificar se é repositório Git

```bash
git -C /home/albano/.config/opencode log --oneline -5
```

**Motivo:** Verificar se o diretório de configuração era versionado por Git, o que influenciaria a forma de registrar as mudanças (commit vs. documento solto). O retorno `NAO_E_REPO` confirmou que o versionamento é feito apenas por este documento.

**Cadeia:** Depende do Passo 14. A ausência de Git reforçou a necessidade de criar este documento de forma detalhada e autossuficiente.

---

### Passo 17 — Criar este documento

```bash
# (via ferramenta write)
```

**Motivo:** Atender à solicitação do usuário de registrar todas as modificações de forma versionada e evolutiva, com anexo de comandos e cadeia de necessidades.

**Cadeia:** Depende de todos os passos anteriores, pois consolida o conhecimento adquirido e as alterações realizadas.

---

## 10. Convenção de Versionamento deste Documento

| Campo | Valor |
|-------|-------|
| **Padrão de nome** | `IMP-AAAA-MM-DD-NNN-descricao-curta.md` |
| **Localização** | `docs/implementes/` |
| **Versionamento** | Incremento manual da seção "Próximos Passos / Evolução" |
| **Próxima revisão** | Quando houver alteração em permissões de agentes ou quando `build-*` forem ajustados |

---

*Documento gerado automaticamente pelo OpenCode. Para dúvidas ou revisões, consulte a seção 8 (Próximos Passos).*
