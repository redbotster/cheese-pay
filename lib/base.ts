/** Optional mount path. Empty when the app owns the domain; set NEXT_PUBLIC_BASE_PATH=/for-ai to serve it under 1claw.co/for-ai. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
