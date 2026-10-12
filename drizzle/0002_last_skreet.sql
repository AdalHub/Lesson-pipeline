ALTER TABLE "teks_standards" ADD COLUMN "source_kind" text DEFAULT 'official' NOT NULL;
--> statement-breakpoint
INSERT INTO "teks_standards" (
	"code", "subject", "grade_level", "course", "knowledge_and_skills",
	"student_expectation", "description", "effective_version", "source_url", "source_kind", "search_text"
) VALUES (
	'7.6C', 'science', 7, NULL, 'Matter and energy',
	'Distinguish between physical and chemical changes in matter.',
	'Distinguish between physical and chemical changes in matter.',
	'19 TAC Chapter 112 (implemented 2024)',
	'https://tea.texas.gov/academics/subject-areas/science/tif-physical-and-chemical-changes-may-24-0.pdf',
	'official',
	'science physical chemical changes matter melting freezing rusting burning baking new substance seventh grade'
) ON CONFLICT ("subject", "code", "effective_version") DO NOTHING;
