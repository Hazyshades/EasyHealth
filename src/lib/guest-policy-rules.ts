export type GuestCreationConfiguration = {
  rateLimitConfigured: boolean;
  abuseChallengeEnabled: boolean;
  abuseChallengeRequired: boolean;
};

export function isGuestCreationConfigured(
  configuration: GuestCreationConfiguration,
): boolean {
  return (
    configuration.rateLimitConfigured &&
    !configuration.abuseChallengeRequired &&
    !configuration.abuseChallengeEnabled
  );
}
