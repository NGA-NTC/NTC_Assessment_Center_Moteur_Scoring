import { supabase } from "../../lib/supabaseClient.js";

export async function updateFeature(featureId, { name, description, page_id, category }) {
  const { error } = await supabase
    .from("features")
    .update({ name, description, page_id, category })
    .eq("id", featureId);

  if (error) throw error;
}