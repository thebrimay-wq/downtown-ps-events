import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache is configured, so routes that declare `revalidate`
// render on demand instead of being cached at the edge. That keeps the
// setup free of extra Cloudflare resources. To cache ISR output, enable R2
// in the dashboard and add `r2IncrementalCache` here — see
// https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig();
