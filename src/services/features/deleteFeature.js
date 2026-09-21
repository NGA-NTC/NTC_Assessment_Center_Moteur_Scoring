import { supabase } from "../../lib/supabaseClient.js";

export async function deleteFeature(featureId) {
  const { error } = await supabase
    .from("features")
    .delete()
    .eq("id", featureId);

  if (error) throw error;
}