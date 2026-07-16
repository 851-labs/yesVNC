import { resolve } from "node:path";

import { startViewerServer } from "../src/services/server";

await smokeCustomViewer();
await smokeNoVncViewer();

console.log("Viewer server smoke tests passed");

async function smokeCustomViewer() {
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
}

async function smokeNoVncViewer() {
  const viewer = await startViewerServer(
    {
      host: "example.local",
      name: "Example",
      password: "secret",
      port: 5900,
      username: "alex",
    },
    {
      noVncAssetPath: resolve(import.meta.dir, "..", "vendor", "novnc"),
      viewer: "novnc",
    },
  );

  try {
    const unauthorized = await fetch(`http://127.0.0.1:${viewer.port}/defaults.json`);
    if (unauthorized.status !== 404) throw new Error("noVNC settings were not protected");

    const page = await fetch(viewer.url, { redirect: "manual" });
    if (page.status !== 302) throw new Error(`noVNC session did not redirect (${page.status})`);
    const cookie = page.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie) throw new Error("noVNC page did not establish a session cookie");

    const headers = { cookie };
    const cleanPage = await fetch(`http://127.0.0.1:${viewer.port}/vnc.html`, { headers });
    if (!cleanPage.ok) throw new Error(`noVNC page failed with ${cleanPage.status}`);
    if (!cleanPage.headers.get("content-security-policy")) {
      throw new Error("noVNC page did not include its content security policy");
    }

    const defaults: unknown = await fetch(`http://127.0.0.1:${viewer.port}/defaults.json`, {
      headers,
    }).then((response) => response.json());
    if (
      !defaults ||
      typeof defaults !== "object" ||
      !("username" in defaults) ||
      !("password" in defaults) ||
      !("autoconnect" in defaults) ||
      defaults.username !== "alex" ||
      defaults.password !== "secret" ||
      defaults.autoconnect !== true
    ) {
      throw new Error("noVNC defaults did not contain the expected session settings");
    }

    const mandatory: unknown = await fetch(`http://127.0.0.1:${viewer.port}/mandatory.json`, {
      headers,
    }).then((response) => response.json());
    if (
      !mandatory ||
      typeof mandatory !== "object" ||
      !("path" in mandatory) ||
      !("show_dot" in mandatory) ||
      mandatory.path !== "socket" ||
      mandatory.show_dot !== true
    ) {
      throw new Error("noVNC mandatory settings were incorrect");
    }

    const staticAsset = await fetch(`http://127.0.0.1:${viewer.port}/app/ui.js`);
    if (!staticAsset.ok) throw new Error("noVNC static assets were not served");
    const missing = await fetch(`http://127.0.0.1:${viewer.port}/missing.js`);
    if (missing.status !== 404) throw new Error("Missing noVNC assets did not return 404");
  } finally {
    viewer.stop();
  }
}
