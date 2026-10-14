INSERT INTO "department_backgrounds" (
    "department_background_id",
    "department_id",
    "background_id"
)
SELECT
    gen_random_uuid()::text,
    "dept_id",
    "background_id"
FROM "departments"
WHERE "background_id" IS NOT NULL
ON CONFLICT ("department_id", "background_id") DO NOTHING;
