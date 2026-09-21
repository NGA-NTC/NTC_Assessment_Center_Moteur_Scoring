import { supabase } from "../../lib/supabaseClient.js";

export async function createFeature({ id, name, description, page_id, category }) {
  const { error } = await supabase
    .from("features")
    .insert({ id, name, description, page_id, category });

  if (error) throw error;
}