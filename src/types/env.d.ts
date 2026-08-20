declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string
    SUPABASE_SECRET_KEY: string
  }
}
