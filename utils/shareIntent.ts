// Module-level store for incoming share intents.
// The root layout sets this when a share arrives,
// the Shopping tab reads and clears it on focus.

let pendingUri: string | null = null

export function setPendingSharedUri(uri: string | null) {
  pendingUri = uri
}

export function getPendingSharedUri(): string | null {
  return pendingUri
}
