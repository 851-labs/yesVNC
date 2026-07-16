import { startViewerServer } from "../src/services/server";

const viewer = await startViewerServer(
  { host: "example.local", name: "Example", port: 5900 },
  { viewerAssetPath: import.meta.filename },
);

try {
  const root = new URL(viewer.url);
  const unauthorized = await fetch(`http://127.0.0.1:${viewer.port}/session.json`);
  if (unauthorized.status !== 404) throw new Error("Session endpoint was not protected");

  const sessionUrl = new URL("/session.json", root);
  sessionUrl.search = root.search;
  const session: unknown = await fetch(sessionUrl).then((response) => response.json());
  if (
    !session ||
    typeof session !== "object" ||
    !("host" in session) ||
    !("port" in session) ||
    session.host !== "example.local" ||
    session.port !== 5900
  ) {
    throw new Error("Session endpoint returned the wrong target");
  }
} finally {
  viewer.stop();
}

console.log("Viewer server smoke test passed");
