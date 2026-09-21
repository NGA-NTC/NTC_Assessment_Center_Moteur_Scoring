import { supabase } from "../../../lib/supabaseClient.js";

export async function createUserAccount({
  email,
  password,
  firstName = "",
  lastName = "",
  role,
  status = "active",
}) {
  const { data, error } = await supabase.rpc("admin_create_user", {
    p_email: email,
    p_password: password,
    p_first_name: firstName,
    p_last_name: lastName,
  });
  if (error) throw error;

  const userId = data?.user_id;
  if (!userId) throw new Error("Création de compte : identifiant utilisateur manquant");

  if (role) {
    const { error: roleError } = await supabase.rpc("assign_user_role", {
      p_target_user_id: userId,
      p_role_id: role,
      p_expires_at: null,
    });
    if (roleError) throw roleError;
  }

  if (status === "inactive") {
    const { error: statusError } = await supabase.rpc("admin_set_user_active", {
      p_target_user_id: userId,
      p_active: false,
    });
    if (statusError) throw statusError;
  }

  return { id: userId, email: data.email };
}