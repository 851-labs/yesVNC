import { resolve } from "node:path";

import { startViewerServer } from "../src/services/server";

await smokeViewer();

console.log("Viewer server smoke test passed");

async function smokeViewer() {
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
    const bootstrap = await fetch(`http://127.0.0.1:${viewer.port}/app/yesvnc-bootstrap.js`).then(
      (response) => response.text(),
    );
    if (!bootstrap.includes("RFB.cursors.dot = fallbackCursor")) {
      throw new Error("Accessible noVNC fallback cursor was not served");
    }
    const missing = await fetch(`http://127.0.0.1:${viewer.port}/missing.js`);
    if (missing.status !== 404) throw new Error("Missing noVNC assets did not return 404");
  } finally {
    viewer.stop();
  }
}
