import { createClient } from "@supabase/supabase-js";
import { workerEnv } from "./env.js";

export const supabase = createClient(workerEnv.supabaseUrl, workerEnv.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const LAB_DOCUMENTS_BUCKET = "lab-documents";
