declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string
    NEXT_PUBLIC_SUPABASE_URL: string
    SUPABASE_SECRET_KEY: string
  }
}
