-- This script wipes all challenges, responses, feed posts, and comments.
-- It executes safely and guarantees a fresh start for testing!
-- (Your user profiles and friends lists will remain untouched)

DELETE FROM comments;
DELETE FROM feed_posts;
DELETE FROM challenge_responses;
DELETE FROM challenges;
