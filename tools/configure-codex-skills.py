#!/usr/bin/env python3
"""Check (default) or apply reviewed, local Codex registration overrides.

No downloads, shell configuration, product changes, or upstream template edits.
After any upstream upgrade, review the new source before changing PIN.
"""
import argparse
import os
from pathlib import Path
import re
import subprocess

PIN = "0530392821c277b95e5cd65aa9d9fda4248718b2"
SHARED = {
    "agents": ".agents/skills/gstack/agents",
    "docs": "docs",
    "scripts": "scripts",
    "review/specialists": "review/specialists",
    "qa/templates": "qa/templates",
    "qa/references": "qa/references",
    "design/dist": "design/dist",
    "make-pdf/dist": "make-pdf/dist",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write reviewed overrides")
    args = parser.parse_args()
    repo = Path.home() / ".gstack/repos/gstack"
    skills = Path.home() / ".codex/skills"
    generated = repo / ".agents/skills"
    revision = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
    if revision != PIN:
        raise SystemExit("Unreviewed gstack revision; inspect the upgrade before changing PIN.")
    entries = sorted(p for p in skills.iterdir() if p.name == "gstack" or p.name.startswith("gstack-"))
    if len(entries) != 54:
        raise SystemExit(f"Expected 54 registrations at the reviewed revision, got {len(entries)}")
    pending = []
    # Preflight the whole plan before writing anything; never replace foreign paths.
    for entry in entries:
        target = generated / entry.name
        skill = entry / "SKILL.md"
        if skill.resolve() != (target / "SKILL.md").resolve() or not target.is_dir():
            raise SystemExit(f"Unexpected registration target: {entry}")
        content = skill.read_text()
        head, body = content.split("\n---", 1)
        old = re.findall(r"^name: (.+)$", head, re.M)
        if len(old) != 1 or old[0] not in {entry.name, entry.name.removeprefix("gstack-")}:
            raise SystemExit(f"Unexpected frontmatter name: {skill}")
        normalized = re.sub(r"^name: .+$", f"name: {entry.name}", head, flags=re.M) + "\n---" + body
        metadata = target / "agents/openai.yaml"
        yaml = metadata.read_text()
        if len(re.findall(r"^  allow_implicit_invocation: (true|false)$", yaml, re.M)) != 1:
            raise SystemExit(f"Unexpected invocation policy format: {metadata}")
        configured = re.sub(r"^  allow_implicit_invocation: (true|false)$", "  allow_implicit_invocation: false", yaml, flags=re.M)
        configured, count = re.subn(r'^  default_prompt: .*$', f'  default_prompt: "Use ${entry.name} for this task."', configured, flags=re.M)
        if count != 1:
            raise SystemExit(f"Unexpected default prompt: {metadata}")
        for path, before, after in [(target / "SKILL.md", content, normalized), (metadata, yaml, configured)]:
            if before != after:
                pending.append(("write", path, after))
    for relative, source in SHARED.items():
        destination, target = skills / "gstack" / relative, repo / source
        if not target.is_dir():
            raise SystemExit(f"Missing shared resource: {target}")
        if os.path.lexists(destination):
            if not destination.is_symlink() or destination.resolve() != target.resolve():
                raise SystemExit(f"Refusing to replace existing resource: {destination}")
        else:
            pending.append(("link", destination, target))
    if args.apply:
        for kind, path, value in pending:
            if kind == "write":
                path.write_text(value)
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.symlink_to(value, target_is_directory=True)
        print(f"Applied {len(pending)} registration/resource changes; 54 skills checked.")
    elif pending:
        for kind, path, _ in pending:
            print(f"Needs {kind}: {path}")
        raise SystemExit("Run with --apply after reviewing the listed changes.")
    else:
        print("PASS: 54 prefixed, explicit-only Codex registrations and 8 shared-resource links.")


if __name__ == "__main__":
    main()
