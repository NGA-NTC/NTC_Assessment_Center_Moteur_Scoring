DO $$
BEGIN
    SET LOCAL request.jwt.claims = '{"sub": "43e703b7-eb9f-417f-927d-f0bffb5ad0de", "role": "authenticated"}';
    INSERT INTO public.role_permissions (role_id, permission_id, can_use, can_manage, can_grant, can_delegate)
    VALUES ('admin', 'users.view', true, false, false, false);
END $$;