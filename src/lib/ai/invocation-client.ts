/**
 * Minimal database-client contract needed to persist an AI invocation.
 *
 * Worker and application dependencies may resolve separate Supabase package
 * instances. Keeping only the operation used at this boundary avoids coupling
 * trace typing to either package instance.
 */
export type AiInvocationClient = {
  from(table: string): {
    insert(values: unknown): PromiseLike<{
      error: { message: string } | null;
    }>;
  };
};
