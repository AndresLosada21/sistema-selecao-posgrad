UPDATE "Inscricao" AS i
SET "temaRedacaoEditalId" = t."id"
FROM "ParticipacaoEdital" AS p
JOIN "TemaRedacaoEdital" AS t
  ON t."editalId" = p."editalId"
WHERE i."participacaoEditalId" = p."id"
  AND i."temaRedacaoEditalId" IS NULL
  AND i."temaRedacao" IS NOT NULL
  AND LOWER(TRIM(i."temaRedacao")) = LOWER(TRIM(t."titulo"))
  AND NOT EXISTS (
    SELECT 1
    FROM "TemaRedacaoEdital" AS t2
    WHERE t2."editalId" = p."editalId"
      AND LOWER(TRIM(t2."titulo")) = LOWER(TRIM(i."temaRedacao"))
      AND t2."id" <> t."id"
  );
