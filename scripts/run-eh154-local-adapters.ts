async function main(): Promise<void> {
  const requiredEnvironment = {
    SUPABASE_SERVICE_ROLE_KEY: "ci-placeholder",
    OPENAI_API_KEY: "ci-placeholder",
    NEXT_PUBLIC_SUPABASE_URL: "https://ci-placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-placeholder",
  } as const;

  for (const [name, value] of Object.entries(requiredEnvironment)) {
    if (!process.env[name]) process.env[name] = value;
  }

  // Static import cannot work here because report-export validates env at module load.
  await import("./verify-eh154-local-adapters");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
