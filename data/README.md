# TEKS snapshot provenance

`teks-expanded.json` adds **593** official lettered expectations:

- 303 English Language Arts/Reading, grades 1–5, adopted 2017.
- 290 Social Studies, grades 1–5, adopted 2022 (implemented 2024–2025).

Downloaded from the current-rule PDFs linked by TEA's Chapter 110 and Chapter 113
pages on 2026-10-12 UTC. The JSON records each source URL and SHA-256 digest.
These are published regulatory standards, not model-generated descriptions.

Reproduce with `python scripts/extract-teks.py` (requires `pypdf`). Review the JSON
diff before running `npm run teks:import`. The importer uses a transaction and the
subject/code/version unique key; repeated imports do not duplicate rows. Changes
to an existing adoption version require a reviewed migration, not silent overwrites.

Extraction preserves roman-numeral subparts in their lettered parent. It excludes
kindergarten, secondary grades, and standalone non-lettered expectations. Sources
are public curriculum rules; page furniture/introduction paragraphs are removed.
Spot checks: ELAR 3.6F (inference/evidence), social studies 5.14A (Declaration of
Independence) and 5.14B (Constitution/Preamble). Unit tests validate these anchors,
unique keys, coverage per grade and removal of source/footer artifacts.

The original math/science entries remain curated subsets. This is **not a complete
K–12 TEKS corpus**. A correct code lookup does not prove a question's semantic match.
