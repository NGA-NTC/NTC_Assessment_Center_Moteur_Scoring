import { supabase } from "../../lib/supabaseClient.js";

export async function createPage({ id, name, path, description, icon }) {
  const { error } = await supabase
    .from("pages")
    .insert({ id, name, path, description, icon });

  if (error) throw error;
}