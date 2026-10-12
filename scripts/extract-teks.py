"""Extract published TEA elementary ELAR/social-studies expectations, without an LLM.

Requires pypdf. Writes a reviewable JSON snapshot, not the database.
Source documents are cached locally and their SHA-256 hashes recorded.
"""
import hashlib
import io
import json
import re
import urllib.request
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
sources = [
    (110, "reading_language_arts", 2, "Adopted 2017"),
    (113, "social_studies", 11, "Adopted 2022"),
]
records = []
manifest = []
for chapter, subject, offset, version in sources:
    url = f"https://tea.texas.gov/laws-and-rules/sboe-rules-tac/sboe-tac-currently-effect/ch{chapter}a.pdf"
    data = urllib.request.urlopen(url, timeout=60).read()
    cache = ROOT / "tmp" / "pdfs"
    cache.mkdir(parents=True, exist_ok=True)
    (cache / f"ch{chapter}a.pdf").write_bytes(data)
    pages = PdfReader(io.BytesIO(data)).pages
    # Remove repeating page furniture before joining wrapped lines.
    lines = []
    for page in pages:
        for line in page.extract_text().splitlines():
            line = line.strip()
            if re.search(r"Update\s+Page|Page\s+\d+.*Update|^Elementary\s+§|^§\d+\.A\.\s+Elementary", line):
                continue
            lines.append(line)
    text = "\n".join(lines)
    (cache / f"ch{chapter}a.txt").write_text(text, encoding="utf-8")
    sections = re.split(rf"(?=^§{chapter}\.\d+\.)", text, flags=re.M)
    count_before = len(records)
    for section in sections:
        heading = re.match(rf"§{chapter}\.(\d+)\.([^\n]+)", section)
        if not heading:
            continue
        grade = int(heading[1]) - offset
        if not 1 <= grade <= 5 or f"Grade {grade}" not in heading[2]:
            continue
        if version not in section[:250]:
            raise ValueError(f"Unexpected adoption for {heading[0]}")
        body_match = re.search(r"\([bc]\)\s+Knowledge and skills\.", section)
        if not body_match:
            raise ValueError(f"Missing knowledge and skills for {heading[0]}")
        body = section[body_match.end():].split("Source:")[0]
        strands = list(re.finditer(r"^\((\d+)\)\s+", body, re.M))
        for i, strand in enumerate(strands):
            chunk = body[strand.end():strands[i + 1].start() if i + 1 < len(strands) else len(body)]
            expectations = list(re.finditer(r"^\(([A-Z])\)\s+", chunk, re.M))
            if not expectations:
                continue  # Non-lettered expectations are outside this snapshot's scope.
            knowledge = " ".join(chunk[:expectations[0].start()].split())
            for j, expectation in enumerate(expectations):
                value = " ".join(chunk[expectation.end():expectations[j + 1].start() if j + 1 < len(expectations) else len(chunk)].split())
                if not 8 <= len(value) <= 5000:
                    raise ValueError(f"Suspicious expectation: {value}")
                code = f"{grade}.{strand[1]}{expectation[1]}"
                records.append(dict(code=code, subject=subject, gradeLevel=grade,
                    course=None, knowledgeAndSkills=knowledge,
                    studentExpectation=value, description=value,
                    effectiveVersion=f"19 TAC Chapter {chapter} ({version.lower()})",
                    sourceUrl=url, sourceKind="official",
                    searchText=f"{subject} grade {grade} {knowledge} {value}"))
    count = len(records) - count_before
    if count < 150:
        raise ValueError(f"Unexpectedly small extraction: {chapter}: {count}")
    manifest.append(dict(url=url, sha256=hashlib.sha256(data).hexdigest(), records=count))

keys = [(r['subject'], r['code'], r['effectiveVersion']) for r in records]
assert len(keys) == len(set(keys)), "Duplicate standards"
out = ROOT / "data"
out.mkdir(exist_ok=True)
(out / "teks-expanded.json").write_text(json.dumps(dict(sources=manifest, standards=records), indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))
