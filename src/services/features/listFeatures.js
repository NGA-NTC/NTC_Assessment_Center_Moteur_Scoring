import { supabase } from "../../lib/supabaseClient.js";

export async function listFeatures() {
  const [pagesRes, featuresRes, pfRes] = await Promise.all([
    supabase.from("pages").select("id, name").order("name"),
    supabase.from("features").select("*").order("page_id, name"),
    supabase.from("page_features").select("page_id, feature_id"),
  ]);

  if (pagesRes.error) throw pagesRes.error;
  if (featuresRes.error) throw featuresRes.error;
  if (pfRes.error) throw pfRes.error;

  return {
    pages: pagesRes.data ?? [],
    features: featuresRes.data ?? [],
  };
}