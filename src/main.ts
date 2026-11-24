import { loadConfig } from "./config.js";
import { ResponsePuller } from "./worker.js";

const watch = process.argv.includes("--watch");
const { config, apiKey } = await loadConfig(watch);
const puller = new ResponsePuller(config, apiKey);

if (!watch) {
  await puller.pollOnce();
} else {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  console.info(`Watching for new responses every ${config.pollIntervalMs / 1000}s. Press Ctrl+C to stop.`);
  await puller.watch(controller.signal);
}
