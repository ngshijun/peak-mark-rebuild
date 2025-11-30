-- Remove the handle_new_user trigger and function
-- Profile creation will be handled by the frontend on first login using ensureProfileExists()

-- Drop the trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS public.handle_new_user();
