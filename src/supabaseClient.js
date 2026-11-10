import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ufnnrgjstkcoprdizuor.supabase.co'
const supabaseAnonKey = 'sb_publishable_WXq1RZTwW5BzjwEkRhkZRA_FIRAKSAM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
