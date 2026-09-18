DO $$
BEGIN
    PERFORM public.assign_user_role('1b103e1b-383a-4634-b4b8-f7290cea76fc', 'admin', NULL);
    RAISE NOTICE 'Assign succeeded';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Assign failed: %', SQLERRM;
END $$;