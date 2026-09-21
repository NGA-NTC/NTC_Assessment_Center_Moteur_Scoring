import { supabase } from "../../lib/supabaseClient.js";

export async function updatePage(pageId, { name, path, description, icon }) {
  const { error } = await supabase
    .from("pages")
    .update({ name, path, description, icon })
    .eq("id", pageId);

  if (error) throw error;
}