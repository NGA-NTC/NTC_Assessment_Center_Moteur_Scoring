import { supabase } from "../../lib/supabaseClient.js";

export async function deletePage(pageId) {
  const { error } = await supabase
    .from("pages")
    .delete()
    .eq("id", pageId);

  if (error) throw error;
}