DO $$
DECLARE
  v_my_user_id UUID;
  v_virat_id UUID := gen_random_uuid();
  v_dhoni_id UUID := gen_random_uuid();
  v_challenge_id UUID := gen_random_uuid();
BEGIN
  -- Grab your actual user ID from the database
  SELECT id INTO v_my_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;
  
  -- 1. Create fake auth users
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES 
  (v_virat_id, 'authenticated', 'authenticated', 'virat.mock@crease.com', 'fake', now(), now(), now()),
  (v_dhoni_id, 'authenticated', 'authenticated', 'dhoni.mock@crease.com', 'fake', now(), now(), now());
  
  -- 2. Update their profiles with names and avatars
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES 
  (v_virat_id, 'virat.mock@crease.com', 'Virat Kohli', 'https://i.pravatar.cc/150?img=11'),
  (v_dhoni_id, 'dhoni.mock@crease.com', 'MS Dhoni', 'https://i.pravatar.cc/150?img=12')
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url;

  -- 3. Automatically add them safely as your friends
  INSERT INTO public.friendships (requester_id, receiver_id, status)
  VALUES 
  (v_my_user_id, v_virat_id, 'accepted'),
  (v_my_user_id, v_dhoni_id, 'accepted');

  -- 4. Create an unresolved Challenge created by Virat Kohli on today's Live Match
  INSERT INTO public.challenges (id, creator_id, match_id, match_name, match_date, questions, is_resolved)
  VALUES (
    v_challenge_id,
    v_virat_id,
    'e02475c1-8f9a-4915-a9e8-d4dbc3441c96', -- Mumbai Indians vs Kolkata Knight Riders Valid Live ID
    'Mumbai Indians vs Kolkata Knight Riders',
    '2026-03-29T14:00:00',
    '[
      {"question": "Who will win the match?", "options": ["Mumbai Indians", "Kolkata Knight Riders", "Tie", "Draw"], "answer": null},
      {"question": "Who will score the most runs?", "options": ["Rohit Sharma", "Shreyas Iyer", "Hardik Pandya", "Suryakumar Yadav"], "answer": null}
    ]',
    false
  );

  -- 5. Insert differing answers to see the AI Umpire checkmarks in action!
  
  -- Virat guesses: MI (0) and Shreyas (1)
  INSERT INTO public.challenge_responses (challenge_id, user_id, answers)
  VALUES (v_challenge_id, v_virat_id, '[0, 1]');

  -- Dhoni guesses: KKR (1) and Rohit (0)
  INSERT INTO public.challenge_responses (challenge_id, user_id, answers)
  VALUES (v_challenge_id, v_dhoni_id, '[1, 0]');
  
  -- Your guesses: MI (0) and Rohit (0)
  INSERT INTO public.challenge_responses (challenge_id, user_id, answers)
  VALUES (v_challenge_id, v_my_user_id, '[0, 0]');

END $$;
