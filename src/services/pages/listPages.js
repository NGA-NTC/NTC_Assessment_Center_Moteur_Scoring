import { supabase } from "../../lib/supabaseClient.js";

export async function listPages() {
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .order("id");

  if (error) throw error;
  return data ?? [];
}