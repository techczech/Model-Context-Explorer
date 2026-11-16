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

## 3. Gemini CLI (optional comparison)

- Repo: https://github.com/google-gemini/gemini-cli, main, commit `4fa64e71b9b4e1bb65a86cc2863574f561b82340` (fetched 2026-11-16). Licence: Apache-2.0.
- Files (under `gemini-cli/`), paths under `packages/core/src/`:
  - `snippets.ts.txt` (~15,123): `prompts/snippets.ts`. The system prompt is a TypeScript template (functions for preamble, mandates, workflows, etc., with interpolated tool names), NOT a single rendered string; it is assembled by `prompts/promptProvider.ts` (not taken).
  - `tools-gemini-3.ts.txt` (~6,972): `tools/definitions/model-family-sets/gemini-3.ts`, tool declarations for the Gemini 3 family.
  - `base-declarations.ts.txt` (~1,109): `tools/definitions/base-declarations.ts` (tool name constants).
  - `tool-snapshots.snap.txt` (~16,575): `tools/definitions/__snapshots__/coreToolsModelSnapshots.test.ts.snap`, rendered tool schemas per model (gemini-2.5-pro and gemini-3-pro-preview) from the project's own test snapshots; the closest thing to a plain tool list.
- Tools defined: about 16 distinct per model in the snapshot (activate_skill, ask_user, enter_plan_mode, exit_plan_mode, get_internal_docs, glob, google_web_search, grep_search, list_directory, read_file, read_many_files, replace, run_shell_command, web_fetch, write_file, write_todos); the snapshot also has test variants (activate_skill_empty/single, grep_search_ripgrep).
- Do not show: nothing personal.

## Not obtained

- A rendered, final system prompt for Gemini CLI (only the template source).
- Any tool definitions for claude.ai itself (not published).
- Codex tool schemas as JSON.
