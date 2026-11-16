# Sources provenance

Collected 2026-11-16. Token counts are approximate (tiktoken cl100k_base; not the native tokenizer of any of these models).

## 1. Claude Fable 5.2 (claude.ai / apps) system prompt

- File: `claude-fable-5-2-system-prompt.txt` (~6,415 tokens)
- Source: https://platform.claude.com/docs/en/release-notes/system-prompts/claude-fable-5-2 (raw markdown via the `.md` URL). Entry dated November 9, 2026, the only entry for that page. Fable 5.2 is the newest model on the index (index also lists Opus 5.5, Sonnet 5.5, Haiku 5.5).
- Terms: published by Anthropic on its public docs; no licence stated. Quote with attribution and link.
- Verbatim, with one edit: the docs page wraps the prompt in a ```text code fence and an `<example>` block inside the prompt itself contains a nested ``` fence, which the docs rendering broke into two fences. The three fence-artefact lines at that point (a closing fence, a blank line, a re-opened ```text wrap fence) were removed so the text is continuous. The outer fence is also removed. Nothing else changed.
- Tool instructions: NO. Anthropic's published version covers behaviour only (`<claude_behavior>`: product information, refusal handling, tone and formatting, wellbeing, evenhandedness, knowledge cutoff, forged notices). Anthropic says the published prompts do not apply to the API, and it publishes no tool definitions or tool-use sections for claude.ai (search, artifacts, memory etc. are not shown). The real claude.ai context includes more than this.
- Tools defined: 0.
- Do not show: nothing personal. The prompt mentions an in-prompt example about a copyrighted character; harmless.

## 2. OpenAI Codex CLI (agentic harness)

- Repo: https://github.com/openai/codex, branch main, commit `c0d47262f33fdb866e2012baad52cf6584e37c03` (fetched 2026-11-16).
- Licence: Apache-2.0 (repo LICENSE). Keep the licence notice and attribution if reproduced.
- Files (under `codex/`), repo paths:
  - `codex-base-instructions.txt` (~4,389 tokens): `codex-rs/models-manager/prompt.md`, the BASE_INSTRUCTIONS constant (`include_str!("../prompt.md")` in `models-manager/src/model_info.rs`). Per-model prompt variants also exist (`codex-rs/core/gpt_5_2_prompt.md`, `gpt-5.2-codex_prompt.md`, etc.); the base one was taken. Model-specific `models.json` can override it.
  - `shell_spec.rs.txt` (~2,476): `codex-rs/core/src/tools/handlers/shell_spec.rs`. Defines `exec_command`, `write_stdin`, `request_permissions` (3 tools).
  - `plan_spec.rs.txt` (~362): `codex-rs/core/src/tools/handlers/plan_spec.rs`. Defines `update_plan` (1 tool).
  - `apply_patch_spec.rs.txt` (~304): `codex-rs/core/src/tools/handlers/apply_patch_spec.rs`. Defines `apply_patch` as a freeform (grammar) tool (1 tool).
  - `apply_patch.lark.txt` (~174): `codex-rs/core/assets/tools/apply_patch.lark`, the Lark grammar for apply_patch.
  - `view_image_spec.rs.txt` (~569): `codex-rs/core/src/tools/handlers/view_image_spec.rs`. Defines `view_image` (1 tool).
- Caveat: Codex defines tools in Rust (not JSON), so these are verbatim Rust sources, not JSON schemas. Descriptions are partly conditional (OS, options). Total in these files: 6 tools. Codex has more (multi-agent, MCP resources, tool_search, request_user_input, code mode, etc.; see sibling `*_spec.rs` files in the same folder) that were not taken. If a JSON rendering is needed it must be hand-built from these sources.
- Do not show: nothing personal.

### 2a. Added 2026-11-16 (same repo, same commit `c0d47262f33fdb866e2012baad52cf6584e37c03`, Apache-2.0)

Fetched with `gh api repos/openai/codex/contents/<path>?ref=<commit>`. Verbatim unless stated.

- `compact-prompt.md.txt` (~88 tokens): `codex-rs/prompts/templates/compact/prompt.md`. The prompt Codex sends to ask the model for a handoff summary when it compacts.
- `compact-summary-prefix.md.txt` (~77): `codex-rs/prompts/templates/compact/summary_prefix.md`. The text Codex puts in front of the summary in the new context (`compact.rs` line 408).
- `compaction-excerpts.rs.txt` (~298): verbatim line excerpts, paths and line numbers inside the file. Shows: auto-compaction fires at 90% of the context window (`openai_models.rs` 583-594, `(context_window * 9) / 10`); the fallback model entry has a 272,000-token window and `effective_context_window_percent: 95` (`model_info.rs` 129-133); compaction keeps the user's own recent messages up to 20,000 tokens (`compact.rs` line 69).
- `skills-catalog_prompt.rs.txt` (~2,318): `codex-rs/ext/skills/src/catalog_prompt.rs`. The real "## Skills" intro and usage rules that come before the skill list (the source-locator variant, ~745 tokens rendered, is quoted on the site; the skill names listed under it on the site are illustrative).
- `environment-context.snap.txt` (~1,064): `codex-rs/core/src/context/world_state/snapshots/codex_core__context__world_state__environment__tests__snapshots.snap`. Rendered `<environment_context>` blocks from Codex's own tests (cwd, shell, current_date, timezone). The site uses this format with illustrative values. No OS field exists in this format.
- `agents-md.snap.txt` (~325): `codex-rs/core/src/context/world_state/snapshots/codex_core__context__world_state__agents_md__tests__snapshots.snap`. Rendered "# AGENTS.md instructions / <INSTRUCTIONS>" wrapper. The site uses the wrapper; the AGENTS.md content is illustrative.
- `sandbox-workspace-write.md.txt` (~58): `codex-rs/prompts/templates/permissions/sandbox_mode/workspace_write.md` (contains a `{{ network_access }}` placeholder).
- `codex-tools-rendered.json` (~1,847): NOT verbatim. A hand-built JSON rendering of the six tools in `shell_spec.rs.txt`, `plan_spec.rs.txt`, `apply_patch_spec.rs.txt` (+ `apply_patch.lark.txt`) and `view_image_spec.rs.txt`, with every description string copied verbatim and options set for macOS with no optional flags (no Windows guidance, no environment_id, permission approvals off). Output schemas are left out. Used for the site's real tool count: 6 tools, about 1,850 tokens, about 310 tokens per tool.

## 3. Gemini CLI (optional comparison)

- Repo: https://github.com/google-gemini/gemini-cli, main, commit `4fa64e71b9b4e1bb65a86cc2863574f561b82340` (fetched 2026-11-16). Licence: Apache-2.0.
- Files (under `gemini-cli/`), paths under `packages/core/src/`:
  - `snippets.ts.txt` (~15,123): `prompts/snippets.ts`. The system prompt is a TypeScript template (functions for preamble, mandates, workflows, etc., with interpolated tool names), NOT a single rendered string; it is assembled by `prompts/promptProvider.ts` (not taken).
  - `tools-gemini-3.ts.txt` (~6,972): `tools/definitions/model-family-sets/gemini-3.ts`, tool declarations for the Gemini 3 family.
  - `base-declarations.ts.txt` (~1,109): `tools/definitions/base-declarations.ts` (tool name constants).
  - `tool-snapshots.snap.txt` (~16,575): `tools/definitions/__snapshots__/coreToolsModelSnapshots.test.ts.snap`, rendered tool schemas per model (gemini-2.5-pro and gemini-3-pro-preview) from the project's own test snapshots; the closest thing to a plain tool list.
- Tools defined: about 16 distinct per model in the snapshot (activate_skill, ask_user, enter_plan_mode, exit_plan_mode, get_internal_docs, glob, google_web_search, grep_search, list_directory, read_file, read_many_files, replace, run_shell_command, web_fetch, write_file, write_todos); the snapshot also has test variants (activate_skill_empty/single, grep_search_ripgrep).
- Do not show: nothing personal.

## 4. Derived figures used on the site

- The site reads its real excerpts and counts from `../real-sources.js`, generated from the files here by `build-excerpts.py` (`uv run --with tiktoken python sources/build-excerpts.py`). Excerpts keep whole paragraphs and mark each gap with the number of paragraphs left out.

- Average size of one tool definition: about 375 tokens. Basis: Codex's 6 tools (1,847 tokens, rendered as above) plus Gemini CLI's 16 tools for gemini-3-pro-preview in `tool-snapshots.snap.txt` (6,389 tokens, measured per snapshot entry, test variants excluded): 8,236 tokens / 22 tools.
- Pages: 500 tokens to a printed page (about 375 words at about 0.75 words per token). A rule of thumb, not a measurement.

## Not obtained

- A rendered, final system prompt for Gemini CLI (only the template source).
- Any tool definitions for claude.ai itself (not published).
- Codex tool schemas as JSON.
