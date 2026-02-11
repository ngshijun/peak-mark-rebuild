-- Recalculate current_streak for all students using the fixed timezone-aware function
DO $$
DECLARE
  v_student RECORD;
BEGIN
  FOR v_student IN SELECT DISTINCT id FROM public.student_profiles LOOP
    PERFORM public.update_student_streak(v_student.id);
  END LOOP;
END;
$$;
