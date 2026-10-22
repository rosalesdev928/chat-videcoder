type Env = Record<string, string | undefined>;

const hasValue = (value: string | undefined) => !!value?.trim();

/** Google sign-in is optional: it is enabled only when both credentials are set */
export function isGoogleAuthConfigured(env: Env = process.env): boolean {
  return hasValue(env.AUTH_GOOGLE_ID) && hasValue(env.AUTH_GOOGLE_SECRET);
}
