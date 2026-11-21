-- =============================================================================
-- validate-itinerary.sql
--
-- Exercises the itinerary data model against a real database and asserts the
-- invariants documented in CLAUDE.md's Data model section.
--
-- SAFE TO RUN. Everything happens inside BEGIN … ROLLBACK, so the script
-- writes nothing: it builds a fake Japan trip, checks it, and throws it away.
-- Re-runnable as often as you like.
--
--   psql "$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '\"')" \
--     -f sql/validate-itinerary.sql
--
-- Every check prints one row: check | expected | actual | result.
-- Expect PASS on 1-8. Check 9 prints FINDING — see its note.
--
-- Scope note: since migration 0003 this schema is five tables and has no
-- geography. There is no city, country or destination, so a day is a trip and
-- a date and nothing else. Earlier versions of this script derived a day's
-- city from trip_destinations date ranges; that check is gone with the table.
-- =============================================================================

\set ON_ERROR_STOP on
\pset pager off
\timing off

\echo ''
\echo '=== BEFORE (live data, must be unchanged at the end) ==='
SELECT (SELECT count(*) FROM trips)      AS trips,
       (SELECT count(*) FROM activities) AS activities,
       (SELECT count(*) FROM day_itineraries) AS days;

BEGIN;

-- -----------------------------------------------------------------------------
-- Setup
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== SETUP ==='

INSERT INTO trips (user_email, name, status, start_date, end_date)
VALUES ('victorli7462@gmail.com', 'Japan 2027 (sandbox)', 'draft',
        '2027-04-01', '2027-04-09')
RETURNING id AS trip_id \gset

-- Nine days. A day is (trip_id, date) — no location column, by design.
INSERT INTO day_itineraries (trip_id, date)
SELECT :'trip_id', d::date
FROM generate_series('2027-04-01'::date, '2027-04-09'::date, interval '1 day') d;

-- Four activities. teamLab is left unplaced on purpose: it is the wishlist.
INSERT INTO activities (user_email, trip_id, name, summary, source, priority_score)
VALUES
  ('victorli7462@gmail.com', :'trip_id', 'Tokyo DisneySea',
   'Nautical-themed Disney park in Urayasu.', 'manual', 5),
  ('victorli7462@gmail.com', :'trip_id', 'Fushimi Inari Shrine',
   'Thousands of vermilion torii up Mount Inari.', 'manual', 4),
  ('victorli7462@gmail.com', :'trip_id', 'Dotonbori',
   'Neon canal strip; takoyaki and kushikatsu.', 'manual', 3),
  ('victorli7462@gmail.com', :'trip_id', 'teamLab Planets',
   'Barefoot immersive digital art in Toyosu.', 'manual', NULL);

SELECT id AS disneysea_id FROM activities WHERE name = 'Tokyo DisneySea'      AND trip_id = :'trip_id' \gset
SELECT id AS inari_id     FROM activities WHERE name = 'Fushimi Inari Shrine' AND trip_id = :'trip_id' \gset
SELECT id AS dotonbori_id FROM activities WHERE name = 'Dotonbori'            AND trip_id = :'trip_id' \gset

-- Placements. DisneySea across two days (the two-day park ticket that motivated
-- the join table) and Fushimi Inari across two more.
INSERT INTO day_itinerary_activities (day_id, activity_id, position)
SELECT d.id, v.activity_id, v.pos
FROM (VALUES ('2027-04-02'::date, :'disneysea_id'::uuid, 1),
             ('2027-04-03'::date, :'disneysea_id'::uuid, 1),
             ('2027-04-04'::date, :'inari_id'::uuid,     1),
             ('2027-04-06'::date, :'inari_id'::uuid,     2),
             ('2027-04-08'::date, :'dotonbori_id'::uuid, 1)
     ) AS v(day_date, activity_id, pos)
JOIN day_itineraries d ON d.trip_id = :'trip_id' AND d.date = v.day_date;

\echo ''
\echo 'Fixture built: 1 trip, 9 days, 4 activities, 5 placements.'

-- -----------------------------------------------------------------------------
-- 1. The day view. Both hops are LEFT JOIN, so days with nothing planned still
--    appear and the wishlist item is not silently dropped.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== 1. Day view (LEFT JOIN both hops) ==='

SELECT d.date,
       coalesce(a.name, '(nothing planned)') AS activity,
       a.priority_score,
       p.position
FROM day_itineraries d
LEFT JOIN day_itinerary_activities p ON p.day_id = d.id
LEFT JOIN activities a               ON a.id = p.activity_id
WHERE d.trip_id = :'trip_id'
ORDER BY d.date, p.position NULLS LAST;

SELECT 'day view returns every day' AS check, 9 AS expected, count(DISTINCT d.id) AS actual,
       CASE WHEN count(DISTINCT d.id) = 9 THEN 'PASS' ELSE 'FAIL' END AS result
FROM day_itineraries d
LEFT JOIN day_itinerary_activities p ON p.day_id = d.id
WHERE d.trip_id = :'trip_id';

-- -----------------------------------------------------------------------------
-- 2. THE POINT: one activity, many days.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== 2. Multi-day placement ==='

SELECT a.name, d.date, p.position
FROM day_itinerary_activities p
JOIN day_itineraries d ON d.id = p.day_id
JOIN activities a     ON a.id = p.activity_id
WHERE p.activity_id = :'disneysea_id'
ORDER BY d.date;

SELECT 'DisneySea is on 2 days' AS check, 2 AS expected, count(*) AS actual,
       CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS result
FROM day_itinerary_activities WHERE activity_id = :'disneysea_id';

SELECT 'DisneySea is still ONE activity row' AS check, 1 AS expected, count(*) AS actual,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM activities WHERE id = :'disneysea_id';

-- -----------------------------------------------------------------------------
-- 3. Wishlist = no placement row. Not a NULL column.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== 3. Wishlist (NOT EXISTS) ==='

SELECT a.name AS unscheduled, a.priority_score
FROM activities a
WHERE a.trip_id = :'trip_id'
  AND NOT EXISTS (SELECT 1 FROM day_itinerary_activities p WHERE p.activity_id = a.id);

SELECT 'wishlist is exactly teamLab Planets' AS check, 'teamLab Planets' AS expected,
       coalesce(string_agg(a.name, ', '), '(none)') AS actual,
       CASE WHEN string_agg(a.name, ', ') = 'teamLab Planets' THEN 'PASS' ELSE 'FAIL' END AS result
FROM activities a
WHERE a.trip_id = :'trip_id'
  AND NOT EXISTS (SELECT 1 FROM day_itinerary_activities p WHERE p.activity_id = a.id);

-- -----------------------------------------------------------------------------
-- 4. UNIQUE (day_id, activity_id) blocks a same-day duplicate.
--    Caught in PL/pgSQL — an uncaught error would abort the whole transaction.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== 4. Same-day duplicate rejected ==='

DO $$
DECLARE v_day uuid; v_act uuid;
BEGIN
  SELECT day_id, activity_id INTO v_day, v_act FROM day_itinerary_activities LIMIT 1;
  INSERT INTO day_itinerary_activities (day_id, activity_id, position)
  VALUES (v_day, v_act, 99);
  RAISE WARNING 'FAIL: duplicate (day_id, activity_id) was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: UNIQUE (day_id, activity_id) rejected the duplicate';
END $$;

-- -----------------------------------------------------------------------------
-- 5. UNIQUE (trip_id, date) is what makes day generation a plain upsert.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== 5. Duplicate day rejected; regeneration is an upsert ==='

DO $$
DECLARE v_trip uuid;
BEGIN
  SELECT trip_id INTO v_trip FROM day_itineraries LIMIT 1;
  INSERT INTO day_itineraries (trip_id, date) VALUES (v_trip, '2027-04-01');
  RAISE WARNING 'FAIL: duplicate (trip_id, date) was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: UNIQUE (trip_id, date) rejected the duplicate';
END $$;

INSERT INTO day_itineraries (trip_id, date)
SELECT :'trip_id', d::date
FROM generate_series('2027-04-01'::date, '2027-04-09'::date, interval '1 day') d
ON CONFLICT (trip_id, date) DO NOTHING;

SELECT 'day count after re-running generation' AS check, 9 AS expected, count(*) AS actual,
       CASE WHEN count(*) = 9 THEN 'PASS' ELSE 'FAIL' END AS result
FROM day_itineraries WHERE trip_id = :'trip_id';

-- -----------------------------------------------------------------------------
-- 6. Deleting a day returns its activities to the wishlist.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== 6. Delete a day -> placements cascade, activity survives ==='

SAVEPOINT before_day_delete;

DELETE FROM day_itineraries WHERE trip_id = :'trip_id' AND date = '2027-04-02';

SELECT 'activity survives the day delete' AS check, 1 AS expected, count(*) AS actual,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM activities WHERE id = :'disneysea_id';

SELECT 'its other placement is untouched' AS check, 1 AS expected, count(*) AS actual,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM day_itinerary_activities WHERE activity_id = :'disneysea_id';

ROLLBACK TO SAVEPOINT before_day_delete;

-- -----------------------------------------------------------------------------
-- 7. Deleting a trip destroys everything under it. The opposite rule, on purpose.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== 7. Delete the trip -> activities destroyed ==='

SAVEPOINT before_trip_delete;

DELETE FROM trips WHERE id = :'trip_id';

SELECT 'activities gone'  AS check, 0 AS expected, count(*) AS actual,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM activities WHERE trip_id = :'trip_id'
UNION ALL
SELECT 'days gone', 0, count(*),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM day_itineraries WHERE trip_id = :'trip_id'
UNION ALL
SELECT 'placements gone', 0, count(*),
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM day_itinerary_activities p
JOIN day_itineraries d ON d.id = p.day_id WHERE d.trip_id = :'trip_id';

ROLLBACK TO SAVEPOINT before_trip_delete;

-- -----------------------------------------------------------------------------
-- 8. priority_score is 1-5. NULL means not yet prioritised, not lowest.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== 8. priority_score CHECK (1-5) ==='

SELECT 'NULL priority is allowed (teamLab)' AS check, 1 AS expected, count(*) AS actual,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM activities WHERE trip_id = :'trip_id' AND priority_score IS NULL;

DO $$
DECLARE v_trip uuid; bad int;
BEGIN
  SELECT id INTO v_trip FROM trips WHERE name = 'Japan 2027 (sandbox)';
  FOREACH bad IN ARRAY ARRAY[0, 6] LOOP
    BEGIN
      INSERT INTO activities (user_email, trip_id, name, summary, priority_score)
      VALUES ('victorli7462@gmail.com', v_trip, 'bad ' || bad, 'x', bad);
      RAISE WARNING 'FAIL: priority_score % was accepted', bad;
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'PASS: priority_score % rejected by CHECK', bad;
    END;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 9. The gap. day_itinerary_activities has independent FKs to day_itineraries
--    and activities; nothing requires them to share a trip.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== 9. Cross-trip placement (expected to expose a gap) ==='

INSERT INTO trips (user_email, name, status)
VALUES ('victorli7462@gmail.com', 'Korea 2027 (sandbox)', 'draft')
RETURNING id AS other_trip_id \gset

INSERT INTO day_itineraries (trip_id, date)
VALUES (:'other_trip_id', '2027-06-01')
RETURNING id AS other_day_id \gset

-- A day from the Korea trip paired with an activity from the Japan trip.
INSERT INTO day_itinerary_activities (day_id, activity_id, position)
VALUES (:'other_day_id', :'disneysea_id', 1);

SELECT 'FINDING: placement spans two trips' AS check,
       'rejected (wanted)' AS expected,
       'accepted' AS actual,
       'UNENFORCED' AS result
FROM day_itinerary_activities p
JOIN day_itineraries d ON d.id = p.day_id
JOIN activities a     ON a.id = p.activity_id
WHERE d.trip_id <> a.trip_id;

\echo ''
\echo 'Note: closing check 9 needs a composite FK carrying trip_id, or a'
\echo 'trigger. That is a schema decision, not part of this script.'

-- -----------------------------------------------------------------------------
-- Teardown
-- -----------------------------------------------------------------------------
ROLLBACK;

\echo ''
\echo '=== AFTER (must match BEFORE) ==='
SELECT (SELECT count(*) FROM trips)      AS trips,
       (SELECT count(*) FROM activities) AS activities,
       (SELECT count(*) FROM day_itineraries) AS days;
\echo ''
