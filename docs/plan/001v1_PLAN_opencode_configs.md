# 001v1_PLAN_opencode_configs.md — Planejamento de Versionamento Git para Configuração OpenCode

> **Data:** 2026-08-29  
> **Autor:** OpenCode (assistente)  
> **Tipo:** Planejamento (PLAN)  
> **Versão:** 1.0  
> **Status:** Aprovado para execução  
> **Relacionado:** IMP-2026-08-29-001 (permissões de agentes), 001v1_IMP_opencode_configs.md, 001v1_ADR_opencode_configs_explains.md

---

## 1. Contexto e Motivação

A pasta `~/.config/opencode/` contém toda a configuração personalizada do usuário: agentes, permissões, skills, documentos de implementação e referências externas. Sem versionamento:

- Uma reinstalação ou atualização do opencode pode sobrescrever ou perder personalizações.
- Não há histórico de mudanças para auditoria ou rollback.
- Não há forma de sincronizar a mesma configuração entre máquinas diferentes.

**Objetivo deste planejamento:** Definir a estratégia de versionamento Git para a pasta `~/.config/opencode/`, garantindo que:
1. Nada seja perdido em reinstalações.
2. O repositório seja leve e portável.
3. Dependências externas (skills de terceiros) sejam gerenciadas corretamente.
4. O processo de restauração em uma máquina nova seja documentado e reproduzível.

---

## 2. Inventário da Pasta `~/.config/opencode/`

| Item | Tamanho | Natureza | Decisão de Versionamento |
|------|---------|----------|--------------------------|
| `opencode.jsonc` | ~2 KB | Configuração principal | ✅ Versionar |
| `AGENTS.md` | ~1 KB | Regras globais do usuário | ✅ Versionar |
| `agents/*.md` | ~15 KB | 5 agentes personalizados | ✅ Versionar |
| `commands/` | vazio | Estrutura para comandos customizados | ✅ Versionar (manter estrutura) |
| `skills/` | vazio | Estrutura para skills locais | ✅ Versionar (manter estrutura) |
| `docs/adr/` | vazio | ADRs futuras | ✅ Versionar (manter estrutura) |
| `docs/implementes/` | ~15 KB | Documentos de implementação | ✅ Versionar |
| `docs/plan/` | vazio | Planos futuros | ✅ Versionar (manter estrutura) |
| `tui.json` | ~1 KB | Preferências da TUI | ✅ Versionar |
| `package.json` | ~1 KB | Dependências de plugins/skills npm | ✅ Versionar |
| `package-lock.json` | ~15 KB | Lockfile de dependências npm | ✅ Versionar |
| `node_modules/` | **62 MB** | Dependências instaladas | ❌ **Ignorar** (regenerável) |
| `vendor/agent-skills/` | **2,6 MB** | Skills de terceiros (Addy Osmani) | 🔗 **Git Submodule** |
| `.gitignore` | ~1 KB | Regras de exclusão | ✅ Versionar |

---

## 3. Decisões Arquiteturais

### 3.1 O que versionar vs. o que ignorar

**Versionar:**
- Todos os arquivos de configuração e personalização.
- `package.json` e `package-lock.json`: necessários para reinstalar plugins/skills npm de forma reproduzível.
- Estrutura de pastas vazias (`commands/`, `skills/`, `docs/adr/`, `docs/plan/`): mantidas no Git via `.gitkeep` ou simplesmente por existirem no repositório.

**Ignorar:**
- `node_modules/`: 62 MB de dependências que podem ser reinstaladas com `npm install`.
- Arquivos de cache, sessões e histórico local do opencode.
- Segredos e variáveis de ambiente.

### 3.2 Tratamento de `vendor/agent-skills/` como Submodule

A pasta `vendor/agent-skills/` já é um clone independente do repositório `https://github.com/addyosmani/agent-skills.git`. Em vez de copiar seus 2,6 MB para o nosso repositório, a estratégia é:

1. **Registrar como submodule Git**: o repositório principal armazena apenas uma referência (commit hash + URL).
2. **Ao clonar em uma nova máquina**: `git submodule update --init` baixa a versão exata.
3. **Para atualizar as skills**: `cd vendor/agent-skills && git pull origin main`, depois commit no repositório principal.

**Vantagens:**
- Repositório principal leve (~50 KB sem o vendor).
- Versão exata das skills é travada pelo submodule.
- Atualizações das skills são explícitas e rastreáveis.

**Riscos mitigados:**
- Se o repositório original for deletado: o submodule mantém o commit local; basta ter um fork ou backup.
- Se a máquina nova não tiver internet: o submodule pode ser copiado manualmente.

### 3.3 Estratégia de Branches

```
main (sempre estável)
  │
  ├── feature/ajustes-permissoes    ← mudanças de configuração
  ├── feature/novos-agentes         ← criação de agentes
  └── fix/correcao-docs             ← correções pontuais
```

- **Trunk-based development**: branches de curta duração (1-3 dias).
- **Merge para main** assim que a mudança for validada.
- **Tags** para marcar versões estáveis da configuração (ex.: `v1.0.0` quando a configuração estiver madura).

---

## 4. Estrutura do Repositório

```
~/.config/opencode/
├── .git/                          ← Metadados do Git
├── .gitignore                     ← Regras de exclusão
├── .gitmodules                    ← Configuração do submodule
│
├── opencode.jsonc                 ← Configuração principal
├── AGENTS.md                      ← Regras globais
├── tui.json                       ← Preferências da TUI
├── package.json                   ← Dependências npm
├── package-lock.json              ← Lockfile npm
│
├── agents/                        ← Agentes personalizados
│   ├── build-ask.md
│   ├── build-auto.md
│   ├── build-guarded.md
│   ├── plan.md
│   └── plan-refine.md
│
├── commands/                      ← Comandos customizados (vazio)
├── skills/                        ← Skills locais (vazio)
│
├── docs/                          ← Documentação
│   ├── adr/                       ← Architecture Decision Records
│   ├── implementes/               ← Documentos de implementação
│   │   └── 001v1_PLAN_opencode_configs.md   ← este arquivo
│   │   └── 001v1_IMP_opencode_configs.md    ← implementação
│   │   └── 001v1_ADR_opencode_configs_explains.md ← ADR/git-flow
│   └── plan/                      ← Planos futuros
│
└── vendor/                        ← Dependências externas
    └── agent-skills/              ← Submodule: addyosmani/agent-skills
```

---

## 5. Fluxo de Trabalho (Git-Flow) do Repositório

### 5.1 Para o usuário (dia a dia)

```
1. Fazer alterações nos arquivos de configuração
2. git add <arquivos>
3. git commit -m "tipo: descrição curta"
4. git push (se houver remote)
```

### 5.2 Para adicionar/atualizar skills de terceiros

```
1. cd vendor/agent-skills
2. git pull origin main
3. cd ..
4. git add vendor/agent-skills
5. git commit -m "chore: atualiza agent-skills para <versão/commit>"
```

### 5.3 Para adicionar um novo agente

```
1. Criar arquivo em agents/<nome>.md
2. Testar localmente
3. git add agents/<nome>.md
4. git commit -m "feat: adiciona agente <nome>"
```

---

## 6. Cenários de Risco e Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|-------------|---------|-----------|
| Reinstalação do opencode sobrescreve arquivos | Média | Alto | Versionar tudo; reinstalação não apaga `.git/` |
| Conflito de `package.json` com update do opencode | Baixa | Médio | `package.json` na pasta de config é do usuário, não do opencode |
| Submodule desatualizado em máquina nova | Média | Médio | Documentar `git submodule update --init` no ADR |
| Usuário esquece de commitar mudanças | Alta | Médio | Criar alias ou hook de lembrete; documentar no ADR |
| `node_modules/` corrompido | Baixa | Baixo | Deletar e `npm install` — por isso não versionamos |

---

## 7. Critérios de Aceite deste Planejamento

- [x] Inventário completo da pasta de configuração.
- [x] Decisão documentada sobre o que versionar vs. ignorar.
- [x] Estratégia de submodule para `vendor/agent-skills/`.
- [x] Estrutura de branches definida.
- [x] Riscos identificados e mitigados.
- [ ] Execução: inicializar Git, criar `.gitignore`, adicionar submodule, primeiro commit. **→ Responsabilidade do documento IMP**
- [ ] Documentação de restauração: como clonar e configurar em máquina nova. **→ Responsabilidade do documento ADR**

---

## 8. Referências

- [Documentação oficial do opencode — Configuração](https://opencode.ai/docs/config/)
- [Git Submodules — Documentação oficial](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- Skill carregada: `git-workflow-and-versioning` (Addy Osmani)

---

*Documento de planejamento. A execução está em `001v1_IMP_opencode_configs.md`. A explicação de git-flow e restauração está em `001v1_ADR_opencode_configs_explains.md`.*
