// Safe to import from anywhere on the server (layouts included): no SDK, no
// knowledge index, just the one question of whether the Ask panel has a key.
export function chatEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
