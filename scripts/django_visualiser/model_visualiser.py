#!/usr/bin/env python3
"""
Django Model Visualizer
Usage:
    python model_visualiser.py path/to/models.py
    python model_visualiser.py models_a.py models_b.py models_c.py
    python model_visualiser.py path/to/models.py -o output.html
    python model_visualiser.py path/to/models.py --open

    One input file  -> one HTML (default name: <app>_models_visual.html in cwd)
    Multiple inputs -> one combined HTML (default name: all_models_visual.html)
    By default, HTML is written to the current working directory (where you
    run the command), not next to models.py.
"""

import re
import sys
import json
import argparse
import webbrowser
from pathlib import Path

# ─── Parser ───────────────────────────────────────────────────────────────────

def parse_models(source: str) -> list[dict]:
    models = []
    lines = source.splitlines()
    current = None
    in_meta = False
    in_def = False

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        class_match = re.match(r'^class\s+(\w+)\s*\(([^)]*)\)\s*:', stripped)
        if class_match:
            name = class_match.group(1)
            parent = class_match.group(2).strip()
            if "Model" in parent:
                if current:
                    models.append(current)
                current = {"name": name, "fields": []}
                in_meta = in_def = False
            else:
                current = None
            i += 1
            continue

        if not current:
            i += 1
            continue

        if stripped.startswith("class Meta:"):
            in_meta = True
            in_def = False
            i += 1
            continue

        if stripped.startswith("def "):
            in_def = True
            in_meta = False
            i += 1
            continue

        if in_def or in_meta:
            # Exit nested block when we hit a line at the model's indentation level (4 spaces)
            indent = len(line) - len(line.lstrip())
            if stripped and indent <= 4:
                in_def = in_meta = False
            else:
                i += 1
                continue

        field_match = re.match(r'^(\w+)\s*=\s*models\.(\w+)\s*\((.*)', stripped)
        if field_match:
            fname = field_match.group(1)
            ftype = field_match.group(2)
            args = field_match.group(3)

            # Collect multi-line field definitions
            j = i
            while ")" not in args and j < len(lines) - 1:
                j += 1
                args += " " + lines[j].strip()
            args = re.sub(r'\).*$', '', args)

            related = None
            rel_types = {"ForeignKey", "ManyToManyField", "OneToOneField"}
            if ftype in rel_types:
                rel_match = re.match(r"['\"]?(\w+)['\"]?", args)
                if rel_match:
                    related = current["name"] if rel_match.group(1) == "self" else rel_match.group(1)

            attrs = []
            if "primary_key=True" in args: attrs.append("PK")
            if "unique=True"      in args: attrs.append("unique")
            if "null=True"        in args: attrs.append("null")
            if "blank=True"       in args: attrs.append("blank")
            if "auto_now_add=True" in args: attrs.append("auto_add")
            if "auto_now=True"    in args: attrs.append("auto_now")
            max_match = re.search(r'max_length=(\d+)', args)
            if max_match: attrs.append(f"max={max_match.group(1)}")

            if fname and not fname.startswith("_"):
                current["fields"].append({
                    "name": fname,
                    "type": ftype,
                    "attrs": attrs,
                    "related": related,
                })

        i += 1

    if current:
        models.append(current)
    return models


# ─── HTML Template ────────────────────────────────────────────────────────────

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Django Models — {title}</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

  :root {{
    --bg:        #F8F7F4;
    --surface:   #FFFFFF;
    --surface2:  #F1EFE8;
    --border:    rgba(0,0,0,0.10);
    --border2:   rgba(0,0,0,0.18);
    --text:      #1A1A18;
    --muted:     #6B6B68;
    --faint:     #9B9B98;
    --mono:      'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    --sans:      'Inter', system-ui, sans-serif;
    --radius:    10px;
    --radius-sm: 5px;
  }}

  @media (prefers-color-scheme: dark) {{
    :root {{
      --bg:       #1A1A18;
      --surface:  #242422;
      --surface2: #2C2C2A;
      --border:   rgba(255,255,255,0.10);
      --border2:  rgba(255,255,255,0.18);
      --text:     #F0EDE8;
      --muted:    #A0A09C;
      --faint:    #686864;
    }}
  }}

  body {{
    font-family: var(--sans);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 0;
  }}

  /* ── Header ── */
  header {{
    background: var(--surface);
    border-bottom: 0.5px solid var(--border);
    padding: 18px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    z-index: 100;
  }}

  .header-left h1 {{
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.3px;
  }}
  .header-left p {{
    font-size: 12px;
    color: var(--muted);
    margin-top: 2px;
  }}

  .header-right {{
    display: flex;
    align-items: center;
    gap: 8px;
  }}

  .tab-btn {{
    background: transparent;
    border: 0.5px solid var(--border2);
    border-radius: var(--radius-sm);
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    color: var(--muted);
    font-family: var(--sans);
    transition: all 0.12s;
  }}
  .tab-btn:hover {{ background: var(--surface2); color: var(--text); }}
  .tab-btn.active {{
    background: var(--text);
    color: var(--bg);
    border-color: transparent;
    font-weight: 500;
  }}

  /* ── Stats bar ── */
  .stats-bar {{
    background: var(--surface);
    border-bottom: 0.5px solid var(--border);
    padding: 10px 32px;
    display: flex;
    gap: 28px;
  }}
  .stat {{ display: flex; align-items: baseline; gap: 6px; }}
  .stat-val {{ font-size: 20px; font-weight: 600; }}
  .stat-label {{ font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }}

  /* ── Main ── */
  main {{ padding: 28px 32px; }}

  /* ── Tables view ── */
  .grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 18px;
  }}

  .model-card {{
    background: var(--surface);
    border: 0.5px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: box-shadow 0.15s;
  }}
  .model-card:hover {{ box-shadow: 0 4px 20px rgba(0,0,0,0.08); }}

  .card-header {{
    background: #1e1e1c;
    padding: 11px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }}
  .card-avatar {{
    width: 30px; height: 30px;
    border-radius: 6px;
    background: rgba(255,255,255,0.12);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono);
    font-size: 13px; font-weight: 700;
    color: white;
    flex-shrink: 0;
  }}
  .card-title {{ font-family: var(--mono); font-size: 14px; font-weight: 600; color: white; }}
  .card-meta {{ font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 1px; }}
  .card-badge {{
    margin-left: auto;
    font-size: 10px; padding: 2px 7px;
    border-radius: 4px;
    background: rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.7);
    white-space: nowrap;
  }}

  table {{ width: 100%; border-collapse: collapse; table-layout: fixed; }}
  col.c-name  {{ width: 42%; }}
  col.c-type  {{ width: 32%; }}
  col.c-attrs {{ width: 26%; }}

  thead tr {{ background: var(--surface2); }}
  thead th {{
    padding: 5px 12px;
    font-size: 10px; font-weight: 500;
    color: var(--faint);
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }}
  thead th:not(:first-child) {{ padding-left: 8px; }}

  tbody tr {{ border-bottom: 0.5px solid var(--border); }}
  tbody tr:last-child {{ border-bottom: none; }}

  td {{ padding: 6px 12px; font-size: 13px; vertical-align: middle; }}
  td:not(:first-child) {{ padding-left: 8px; }}

  .fname {{
    font-family: var(--mono);
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .fname.is-rel {{ font-weight: 600; }}
  .fname-related {{
    display: block;
    font-size: 10px;
    color: var(--muted);
    margin-top: 1px;
    font-family: var(--mono);
  }}

  .type-badge {{
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    border: 0.5px solid transparent;
  }}

  .attrs {{ display: flex; gap: 3px; flex-wrap: wrap; }}
  .attr-pill {{
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--surface2);
    color: var(--muted);
    border: 0.5px solid var(--border);
    white-space: nowrap;
  }}

  .section-divider td {{
    background: var(--surface2);
    color: var(--faint);
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 4px 12px;
  }}

  /* ── Relationships view ── */
  .rel-container {{ max-width: 700px; }}
  .rel-summary {{
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 14px;
  }}
  .rel-list {{ display: flex; flex-direction: column; gap: 8px; }}
  .rel-row {{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    background: var(--surface);
    border: 0.5px solid var(--border);
    border-radius: 8px;
    font-size: 13px;
  }}
  .rel-model {{ font-family: var(--mono); font-weight: 600; }}
  .rel-field {{ font-size: 11px; color: var(--muted); font-family: var(--mono); }}
  .rel-arrow {{ color: var(--faint); font-size: 16px; }}

  .legend {{
    margin-top: 22px;
    padding: 14px 16px;
    background: var(--surface);
    border: 0.5px solid var(--border);
    border-radius: 8px;
  }}
  .legend-title {{
    font-size: 10px;
    font-weight: 500;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 10px;
  }}
  .legend-items {{ display: flex; gap: 16px; flex-wrap: wrap; }}
  .legend-item {{ display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }}

  /* ── Hidden ── */
  .hidden {{ display: none !important; }}
</style>
</head>
<body>

<header>
  <div class="header-left">
    <h1>&#128202; Django Model Visualizer</h1>
    <p>{filename}</p>
  </div>
  <div class="header-right">
    <button class="tab-btn active" onclick="showTab('tables')" id="btn-tables">Model Tables</button>
    <button class="tab-btn"        onclick="showTab('rels')"   id="btn-rels">Relationships</button>
  </div>
</header>

<div class="stats-bar">
  <div class="stat">
    <span class="stat-val">{model_count}</span>
    <span class="stat-label">Models</span>
  </div>
  <div class="stat">
    <span class="stat-val">{field_count}</span>
    <span class="stat-label">Fields</span>
  </div>
  <div class="stat">
    <span class="stat-val">{rel_count}</span>
    <span class="stat-label">Relationships</span>
  </div>
</div>

<main>
  <!-- Tables view -->
  <div id="view-tables" class="grid">
    {cards_html}
  </div>

  <!-- Relationships view -->
  <div id="view-rels" class="rel-container hidden">
    <p class="rel-summary">{rel_count} relationship(s) detected across {model_count} models</p>
    <div class="rel-list">
      {rels_html}
    </div>
    <div class="legend">
      <div class="legend-title">Legend</div>
      <div class="legend-items">
        <div class="legend-item">
          <span class="type-badge" style="background:#FAECE7;color:#712B13;border-color:#993C1D">FK</span>
          ForeignKey
        </div>
        <div class="legend-item">
          <span class="type-badge" style="background:#EEEDFE;color:#3C3489;border-color:#534AB7">M2M</span>
          ManyToManyField
        </div>
        <div class="legend-item">
          <span class="type-badge" style="background:#E1F5EE;color:#085041;border-color:#0F6E56">1:1</span>
          OneToOneField
        </div>
      </div>
    </div>
  </div>
</main>

<script>
function showTab(tab) {{
  document.getElementById('view-tables').classList.toggle('hidden', tab !== 'tables');
  document.getElementById('view-rels').classList.toggle('hidden',   tab !== 'rels');
  document.getElementById('btn-tables').classList.toggle('active',  tab === 'tables');
  document.getElementById('btn-rels').classList.toggle('active',    tab === 'rels');
}}
</script>
</body>
</html>
"""

# ─── Field type → badge colors ────────────────────────────────────────────────

FIELD_COLORS = {
    "AutoField":                {"bg": "#E6F1FB", "text": "#0C447C", "border": "#185FA5"},
    "BigAutoField":             {"bg": "#E6F1FB", "text": "#0C447C", "border": "#185FA5"},
    "CharField":                {"bg": "#EAF3DE", "text": "#27500A", "border": "#3B6D11"},
    "TextField":                {"bg": "#EAF3DE", "text": "#27500A", "border": "#3B6D11"},
    "SlugField":                {"bg": "#EAF3DE", "text": "#27500A", "border": "#3B6D11"},
    "IntegerField":             {"bg": "#EEEDFE", "text": "#3C3489", "border": "#534AB7"},
    "BigIntegerField":          {"bg": "#EEEDFE", "text": "#3C3489", "border": "#534AB7"},
    "SmallIntegerField":        {"bg": "#EEEDFE", "text": "#3C3489", "border": "#534AB7"},
    "PositiveIntegerField":     {"bg": "#EEEDFE", "text": "#3C3489", "border": "#534AB7"},
    "PositiveSmallIntegerField":{"bg": "#EEEDFE", "text": "#3C3489", "border": "#534AB7"},
    "FloatField":               {"bg": "#EEEDFE", "text": "#3C3489", "border": "#534AB7"},
    "DecimalField":             {"bg": "#EEEDFE", "text": "#3C3489", "border": "#534AB7"},
    "UUIDField":                {"bg": "#EEEDFE", "text": "#3C3489", "border": "#534AB7"},
    "BooleanField":             {"bg": "#FAEEDA", "text": "#633806", "border": "#854F0B"},
    "JSONField":                {"bg": "#FAEEDA", "text": "#633806", "border": "#854F0B"},
    "DateField":                {"bg": "#FBEAF0", "text": "#72243E", "border": "#993556"},
    "DateTimeField":            {"bg": "#FBEAF0", "text": "#72243E", "border": "#993556"},
    "TimeField":                {"bg": "#FBEAF0", "text": "#72243E", "border": "#993556"},
    "ForeignKey":               {"bg": "#FAECE7", "text": "#712B13", "border": "#993C1D"},
    "ManyToManyField":          {"bg": "#FAECE7", "text": "#712B13", "border": "#993C1D"},
    "OneToOneField":            {"bg": "#FAECE7", "text": "#712B13", "border": "#993C1D"},
    "EmailField":               {"bg": "#E1F5EE", "text": "#085041", "border": "#0F6E56"},
    "URLField":                 {"bg": "#E1F5EE", "text": "#085041", "border": "#0F6E56"},
    "FileField":                {"bg": "#F1EFE8", "text": "#444441", "border": "#5F5E5A"},
    "ImageField":               {"bg": "#F1EFE8", "text": "#444441", "border": "#5F5E5A"},
}
DEFAULT_COLOR = {"bg": "#F1EFE8", "text": "#444441", "border": "#888780"}

REL_TYPES = {"ForeignKey", "ManyToManyField", "OneToOneField"}
REL_LABELS = {"ForeignKey": "FK", "ManyToManyField": "M2M", "OneToOneField": "1:1"}


# ─── HTML builders ────────────────────────────────────────────────────────────

def badge(ftype: str) -> str:
    c = FIELD_COLORS.get(ftype, DEFAULT_COLOR)
    return (
        f'<span class="type-badge" '
        f'style="background:{c["bg"]};color:{c["text"]};border-color:{c["border"]}">'
        f'{ftype}</span>'
    )


def build_card(model: dict) -> str:
    name = model["name"]
    fields = model["fields"]
    rel_fields   = [f for f in fields if f["type"] in REL_TYPES]
    other_fields = [f for f in fields if f["type"] not in REL_TYPES]

    card_meta = f"{len(fields)} fields"
    if model.get("source_label"):
        card_meta += f" · {model['source_label']}"

    rel_count_str = f'{len(rel_fields)} rel' if rel_fields else ''
    badge_html = f'<span class="card-badge">{rel_count_str}</span>' if rel_count_str else ''

    def row(f):
        is_rel = f["type"] in REL_TYPES
        rel_hint = f'<span class="fname-related">→ {f["related"]}</span>' if f.get("related") else ''
        cls = 'fname is-rel' if is_rel else 'fname'
        attrs_html = ''.join(f'<span class="attr-pill">{a}</span>' for a in f["attrs"])
        return (
            f'<tr>'
            f'<td><span class="{cls}">{f["name"]}{rel_hint}</span></td>'
            f'<td>{badge(f["type"])}</td>'
            f'<td><div class="attrs">{attrs_html}</div></td>'
            f'</tr>'
        )

    rows = ''.join(row(f) for f in other_fields)
    if rel_fields and other_fields:
        rows += (
            '<tr class="section-divider">'
            '<td colspan="3">Relationships</td>'
            '</tr>'
        )
    rows += ''.join(row(f) for f in rel_fields)

    return f"""
<div class="model-card">
  <div class="card-header">
    <div class="card-avatar">{name[0]}</div>
    <div>
      <div class="card-title">{name}</div>
      <div class="card-meta">{card_meta}</div>
    </div>
    {badge_html}
  </div>
  <table>
    <colgroup>
      <col class="c-name"><col class="c-type"><col class="c-attrs">
    </colgroup>
    <thead>
      <tr>
        <th>Field</th><th>Type</th><th>Attrs</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
</div>"""


def build_rel_row(rel: dict) -> str:
    ftype = rel["type"]
    c = FIELD_COLORS.get(ftype, DEFAULT_COLOR)
    label = REL_LABELS.get(ftype, ftype)
    type_badge = (
        f'<span class="type-badge" '
        f'style="background:{c["bg"]};color:{c["text"]};border-color:{c["border"]};font-size:10px;font-weight:600">'
        f'{label}</span>'
    )
    return (
        f'<div class="rel-row">'
        f'<span class="rel-model">{rel["from"]}</span>'
        f'<span class="rel-field">·{rel["field"]}·</span>'
        f'{type_badge}'
        f'<span class="rel-arrow">→</span>'
        f'<span class="rel-model">{rel["to"]}</span>'
        f'</div>'
    )


def get_relationships(models: list[dict]) -> list[dict]:
    # Only link models from the same source file (services don't share FKs).
    names_by_source: dict[str, set[str]] = {}
    for model in models:
        source = model.get("source_label", "")
        names_by_source.setdefault(source, set()).add(model["name"])

    rels = []
    for model in models:
        source = model.get("source_label", "")
        model_names = names_by_source.get(source, set())
        for field in model["fields"]:
            if field["type"] in REL_TYPES and field.get("related") in model_names:
                rels.append({
                    "from":  model["name"],
                    "to":    field["related"],
                    "type":  field["type"],
                    "field": field["name"],
                })
    return rels


def load_models_from_paths(paths: list[Path]) -> tuple[list[dict], list[Path]]:
    models: list[dict] = []
    loaded_paths: list[Path] = []

    for src_path in paths:
        if not src_path.exists():
            print(f"Error: file not found: {src_path}", file=sys.stderr)
            sys.exit(1)

        parsed = parse_models(src_path.read_text(encoding="utf-8"))
        if not parsed:
            print(f"Warning: no Django models found in {src_path}", file=sys.stderr)
            continue

        source_label = f"{src_path.parent.name}/{src_path.name}"
        for model in parsed:
            model["source_label"] = source_label
        models.extend(parsed)
        loaded_paths.append(src_path.resolve())

    return models, loaded_paths


def build_html(models: list[dict], title: str, filename_label: str) -> str:
    relationships = get_relationships(models)
    cards_html = "\n".join(build_card(m) for m in models)
    rels_html = (
        "\n".join(build_rel_row(r) for r in relationships)
        if relationships
        else '<p style="color:var(--muted);font-size:14px">No relationships found between models.</p>'
    )
    total_fields = sum(len(m["fields"]) for m in models)

    return HTML_TEMPLATE.format(
        title=title,
        filename=filename_label,
        model_count=len(models),
        field_count=total_fields,
        rel_count=len(relationships),
        cards_html=cards_html,
        rels_html=rels_html,
    )


def default_output_path(src_paths: list[Path], output: str | None) -> Path:
    if output:
        return Path(output)

    if len(src_paths) == 1:
        src_path = src_paths[0]
        default_name = f"{src_path.parent.name}_{src_path.stem}_visual.html"
    else:
        default_name = "all_models_visual.html"

    return Path.cwd() / default_name


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Visualize Django models.py file(s) as a beautiful HTML page."
    )
    parser.add_argument(
        "models_paths",
        nargs="+",
        help="One or more paths to Django models.py files",
    )
    parser.add_argument(
        "-o", "--output",
        help="Output HTML file path (default: per-file or all_models_visual.html in cwd)",
    )
    parser.add_argument(
        "--open",
        action="store_true",
        help="Open the output in your browser automatically",
    )
    args = parser.parse_args()

    src_paths = [Path(p) for p in args.models_paths]
    models, loaded_paths = load_models_from_paths(src_paths)

    if not models:
        print("No Django models found in any input file.", file=sys.stderr)
        sys.exit(1)

    if len(loaded_paths) == 1:
        title = loaded_paths[0].name
        filename_label = str(loaded_paths[0])
    else:
        title = "All Django Models"
        filename_label = " · ".join(str(p) for p in loaded_paths)

    html = build_html(models, title, filename_label)
    out_path = default_output_path(loaded_paths, args.output)
    out_path.write_text(html, encoding="utf-8")

    relationships = get_relationships(models)
    total_fields = sum(len(m["fields"]) for m in models)
    file_note = f" from {len(loaded_paths)} file(s)" if len(loaded_paths) > 1 else ""

    print(f"✓ Parsed {len(models)} models, {total_fields} fields, {len(relationships)} relationships{file_note}")
    print(f"✓ Output: {out_path.resolve()}")

    if args.open:
        webbrowser.open(out_path.resolve().as_uri())
        print("✓ Opened in browser")


if __name__ == "__main__":
    main()