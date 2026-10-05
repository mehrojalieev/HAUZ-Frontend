export function safeRedirectTarget(
  redirect: string | undefined,
  fallback = '/',
): string {
  if (!redirect) {
    return fallback
  }

  if (!redirect.startsWith('/')) {
    return fallback
  }

  if (redirect.startsWith('//') || redirect.startsWith('/\\')) {
    return fallback
  }

  return redirect
}
