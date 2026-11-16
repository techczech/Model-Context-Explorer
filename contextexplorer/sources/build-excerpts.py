"""Build ../real-sources.js: verbatim excerpts and token counts from the files in this folder.

Run from anywhere:  uv run --with tiktoken python sources/build-excerpts.py
Counts use tiktoken cl100k_base (not the native tokenizer of any of these models), as in PROVENANCE.md.
"""
import json, pathlib, re
import tiktoken

HERE = pathlib.Path(__file__).resolve().parent
ENC = tiktoken.get_encoding("cl100k_base")
tok = lambda s: len(ENC.encode(s))
CODEX_SHA = "c0d47262f33fdb866e2012baad52cf6584e37c03"
GH = f"https://github.com/openai/codex/blob/{CODEX_SHA}/"


def paras(text):
    return [p for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]


def excerpt(ps, keep):
    """Keep the 1-based paragraph numbers in `keep`; mark every gap with its size."""
    out, gap = [], 0
    for i, p in enumerate(ps, 1):
        if i in keep:
            if gap:
                out.append(f"[… {gap} more paragraph{'s' if gap > 1 else ''} not shown …]")
                gap = 0
            out.append(p)
        else:
            gap += 1
    if gap:
        out.append(f"[… {gap} more paragraph{'s' if gap > 1 else ''} not shown …]")
    return "\n\n".join(out)


R = {}

# 1. Claude app system prompt (Anthropic, published)
t = (HERE / "claude-fable-5-2-system-prompt.txt").read_text()
ps = paras(t)
keep = {1, 3, 28, 31, 34, 53}
R["claude"] = {
    "text": excerpt(ps, keep), "tokens": tok(t), "paragraphs": len(ps), "shown": len(keep),
    "name": "Claude Fable 5.2 system prompt, published by Anthropic (9 November 2026)",
    "url": "https://platform.claude.com/docs/en/release-notes/system-prompts/claude-fable-5-2",
}

# 2. Codex CLI base instructions
t = (HERE / "codex/codex-base-instructions.txt").read_text()
ps = paras(t)
keep = {1, 7, 8, 16, 39, 84, 85}
R["codexBase"] = {
    "text": excerpt(ps, keep), "tokens": tok(t), "paragraphs": len(ps), "shown": len(keep),
    "name": "Codex CLI base instructions (codex-rs/models-manager/prompt.md)",
    "url": GH + "codex-rs/models-manager/prompt.md",
}

# 3. Codex CLI tools (hand-built JSON rendering of the Rust specs; descriptions verbatim)
tools = json.loads((HERE / "codex/codex-tools-rendered.json").read_text())
shown = [x for x in tools if x["name"] in ("exec_command", "update_plan")]
rest = [x["name"] for x in tools if x not in shown]
R["codexTools"] = {
    "text": json.dumps(shown, indent=2, ensure_ascii=False) + f"\n\n[… {len(rest)} more tool definitions not shown: {', '.join(rest)} …]",
    "tokens": tok((HERE / "codex/codex-tools-rendered.json").read_text()), "count": len(tools),
    "name": "Codex CLI tool specs (codex-rs/core/src/tools/handlers/*_spec.rs), rendered as JSON",
    "url": GH + "codex-rs/core/src/tools/handlers/shell_spec.rs",
}

# 4. Codex skills block: real intro and usage rules (source-locator variant)
src = (HERE / "codex/skills-catalog_prompt.rs.txt").read_text()
intro = re.search(r'SKILLS_INTRO_WITH_SOURCE_LOCATORS: &str = "(.*?)";', src).group(1)
usage = re.search(r'SKILLS_HOW_TO_USE_WITH_SOURCE_LOCATORS: &str = r###"(.*?)"###', src, re.S).group(1)
ub = usage.split("\n- ")
R["codexSkills"] = {
    "head": "## Skills\n" + intro + "\n### Available skills",
    "usage": ub[0] + "\n- " + ub[1] + f"\n[… {len(ub) - 2} more usage rules not shown …]",
    "tokens": tok("## Skills\n" + intro + "\n### Available skills\n" + usage),
    "name": "Codex CLI skills prompt (codex-rs/ext/skills/src/catalog_prompt.rs)",
    "url": GH + "codex-rs/ext/skills/src/catalog_prompt.rs",
}

# 5. Compaction prompt and summary prefix
cp = (HERE / "codex/compact-prompt.md.txt").read_text().strip()
sp = (HERE / "codex/compact-summary-prefix.md.txt").read_text().strip()
R["codexCompact"] = {
    "text": cp, "tokens": tok(cp),
    "name": "Codex CLI compaction prompt (codex-rs/prompts/templates/compact/prompt.md)",
    "url": GH + "codex-rs/prompts/templates/compact/prompt.md",
}
R["codexPrefix"] = {
    "text": sp, "tokens": tok(sp),
    "name": "Codex CLI summary prefix (codex-rs/prompts/templates/compact/summary_prefix.md)",
    "url": GH + "codex-rs/prompts/templates/compact/summary_prefix.md",
}
R["codexCompactRule"] = {
    "name": "Codex CLI auto-compaction limit (codex-rs/protocol/src/openai_models.rs, lines 583-594)",
    "url": GH + "codex-rs/protocol/src/openai_models.rs#L583-L594",
}
R["codexKeepRule"] = {
    "name": "Codex CLI compaction keeps recent user messages up to 20,000 tokens (codex-rs/core/src/compact.rs, line 69)",
    "url": GH + "codex-rs/core/src/compact.rs#L69",
}

# 6. Sandbox permissions text (template; placeholder filled on the site)
sw = (HERE / "codex/sandbox-workspace-write.md.txt").read_text().strip().replace("{{ network_access }}", "restricted")
R["codexSandbox"] = {
    "text": sw, "tokens": tok(sw),
    "name": "Codex CLI sandbox instructions (codex-rs/prompts/templates/permissions/sandbox_mode/workspace_write.md)",
    "url": GH + "codex-rs/prompts/templates/permissions/sandbox_mode/workspace_write.md",
}
R["codexEnv"] = {
    "name": "Codex CLI environment context format (rendered in its own tests)",
    "url": GH + "codex-rs/core/src/context/world_state/snapshots/codex_core__context__world_state__environment__tests__snapshots.snap",
}
R["codexAgents"] = {
    "name": "Codex CLI AGENTS.md wrapper (rendered in its own tests)",
    "url": GH + "codex-rs/core/src/context/world_state/snapshots/codex_core__context__world_state__agents_md__tests__snapshots.snap",
}
R["codexSha"] = CODEX_SHA

out = HERE.parent / "real-sources.js"
out.write_text(
    "/* Context Explorer: verbatim excerpts and token counts from sources/ (see sources/PROVENANCE.md).\n"
    "   Generated by sources/build-excerpts.py. Do not edit by hand.\n"
    "   Codex CLI material: Copyright OpenAI, Apache License 2.0. Claude system prompt: published by Anthropic. */\n"
    "window.CE_REAL = " + json.dumps(R, indent=1, ensure_ascii=False) + ";\n"
)
for k, v in R.items():
    if isinstance(v, dict) and "tokens" in v:
        print(k, v["tokens"], v.get("paragraphs", ""), v.get("count", ""))
