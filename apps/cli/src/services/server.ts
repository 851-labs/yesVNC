import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

export type ViewerKind = "novnc" | "yesvnc";

export interface ViewerTarget {
  readonly host: string;
  readonly name: string;
  readonly password?: string;
  readonly port: number;
  readonly username?: string;
  readonly viewOnly?: boolean;
}

export interface ViewerServer {
  readonly port: number;
  readonly stop: () => void;
  readonly url: string;
}

interface TcpWriter {
  end(): void;
  write(data: Uint8Array): number;
}

interface SocketData {
  queue: Uint8Array[];
  target: ViewerTarget;
  tcp?: TcpWriter;
}

export async function startViewerServer(
  target: ViewerTarget,
  options: {
    noVncAssetPath?: string;
    port?: number;
    viewer?: ViewerKind;
    viewerAssetPath?: string;
  } = {},
): Promise<ViewerServer> {
  const viewerKind = options.viewer ?? "yesvnc";
  const token = randomBytes(24).toString("base64url");
  const viewerScript =
    viewerKind === "yesvnc"
      ? await readFile(options.viewerAssetPath ?? (await findViewerAsset()), "utf8")
      : undefined;
  const noVncRoot =
    viewerKind === "novnc" ? (options.noVncAssetPath ?? (await findNoVncAssets())) : undefined;
  const tcpSockets = new Set<TcpWriter>();

  const server = Bun.serve<SocketData>({
    hostname: "127.0.0.1",
    port: options.port ?? 0,
    async fetch(request, bunServer) {
      const url = new URL(request.url);
      const authorized =
        url.searchParams.get("token") === token || hasSessionCookie(request, token);

      if (url.pathname === "/socket") {
        if (!authorized) return new Response("Not found", { status: 404 });
        if (request.headers.get("origin") !== url.origin) {
          return new Response("Forbidden", { status: 403 });
        }
        const requestedProtocols = request.headers
          .get("sec-websocket-protocol")
          ?.split(",")
          .map((value) => value.trim());
        const protocol = requestedProtocols?.find((value) => value === "binary");
        const upgraded = bunServer.upgrade(request, {
          data: { queue: [], target },
          ...(protocol ? { headers: { "Sec-WebSocket-Protocol": protocol } } : {}),
        });
        return upgraded ? undefined : new Response("Upgrade failed", { status: 400 });
      }

      if (viewerKind === "novnc" && noVncRoot) {
        if (url.pathname === "/" && authorized) {
          return Response.redirect(new URL(`/vnc.html${url.search}`, url), 302);
        }
        if (url.pathname === "/vnc.html") {
          if (!authorized) return new Response("Not found", { status: 404 });
          if (url.searchParams.get("token") === token) {
            return new Response(null, {
              headers: {
                "cache-control": "no-store",
                location: new URL("/vnc.html", url).toString(),
                "set-cookie": sessionCookie(token),
              },
              status: 302,
            });
          }
          return await staticAssetResponse(noVncRoot, url.pathname, {
            "content-security-policy": NOVNC_CONTENT_SECURITY_POLICY,
            "referrer-policy": "no-referrer",
            "x-frame-options": "DENY",
          });
        }
        if (url.pathname === "/defaults.json") {
          if (!authorized) return new Response("Not found", { status: 404 });
          return Response.json(
            {
              autoconnect: true,
              password: target.password,
              reconnect: true,
              reconnect_delay: 1000,
              resize: "scale",
              username: target.username,
            },
            { headers: DYNAMIC_RESPONSE_HEADERS },
          );
        }
        if (url.pathname === "/mandatory.json") {
          if (!authorized) return new Response("Not found", { status: 404 });
          return Response.json(
            {
              path: "socket",
              shared: true,
              show_dot: true,
              view_only: target.viewOnly ?? false,
            },
            { headers: DYNAMIC_RESPONSE_HEADERS },
          );
        }
        return await staticAssetResponse(noVncRoot, url.pathname);
      }

      if (url.pathname === "/viewer.js" && viewerScript !== undefined) {
        return new Response(viewerScript, {
          headers: { "content-type": "text/javascript; charset=utf-8" },
        });
      }
      if (!authorized) return new Response("Not found", { status: 404 });

      if (url.pathname === "/session.json") {
        return Response.json(target, {
          headers: { "cache-control": "no-store" },
        });
      }

      if (url.pathname === "/") return htmlResponse();
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      close(ws) {
        ws.data.tcp?.end();
      },
      message(ws, message) {
        const bytes =
          typeof message === "string" ? new TextEncoder().encode(message) : new Uint8Array(message);
        if (ws.data.tcp) ws.data.tcp.write(bytes);
        else ws.data.queue.push(bytes);
      },
      open(ws) {
        void Bun.connect({
          hostname: ws.data.target.host,
          port: ws.data.target.port,
          socket: {
            close(socket) {
              tcpSockets.delete(socket);
              ws.close(1000, "VNC server closed the connection");
            },
            data(_socket, data) {
              ws.send(data);
            },
            error(socket, error) {
              tcpSockets.delete(socket);
              ws.close(1011, error.message);
            },
            open(socket) {
              ws.data.tcp = socket;
              tcpSockets.add(socket);
              for (const data of ws.data.queue) socket.write(data);
              ws.data.queue.length = 0;
            },
          },
        }).catch((error: unknown) => {
          ws.close(
            1011,
            error instanceof Error ? error.message : "Could not connect to VNC server",
          );
        });
      },
    },
  });
  const serverPort = server.port;
  if (serverPort === undefined) {
    void server.stop(true);
    throw new Error("Bun did not assign a port to the local viewer");
  }

  return {
    port: serverPort,
    stop: () => {
      for (const socket of tcpSockets) socket.end();
      void server.stop(true);
    },
    url: `http://127.0.0.1:${serverPort}/${viewerKind === "novnc" ? "vnc.html" : ""}?token=${token}`,
  };
}

export async function findViewerAsset(): Promise<string> {
  const configured = process.env.YESVNC_VIEWER_ASSET;
  const executableDir = dirname(process.execPath);
  const candidates = [
    configured,
    join(import.meta.dir, "viewer.js"),
    resolve(import.meta.dir, "..", "..", "dist", "viewer.js"),
    resolve(import.meta.dir, "..", "viewer", "dist", "viewer.js"),
    resolve(executableDir, "..", "share", "yesvnc", "viewer.js"),
  ].filter((value): value is string => Boolean(value));

  const availability = await Promise.all(
    candidates.map((candidate) => Bun.file(candidate).exists()),
  );
  const availableIndex = availability.findIndex(Boolean);
  if (availableIndex >= 0) return candidates[availableIndex]!;
  throw new Error(
    `Could not find viewer.js. Looked in:\n${candidates.map((candidate) => `- ${candidate}`).join("\n")}`,
  );
}

export async function findNoVncAssets(): Promise<string> {
  const configured = process.env.YESVNC_NOVNC_ASSET_DIR;
  const executableDir = dirname(process.execPath);
  const candidates = [
    configured,
    resolve(import.meta.dir, "..", "..", "dist", "novnc"),
    resolve(executableDir, "..", "share", "yesvnc", "novnc"),
  ].filter((value): value is string => Boolean(value));

  const availability = await Promise.all(
    candidates.map((candidate) => Bun.file(join(candidate, "vnc.html")).exists()),
  );
  const availableIndex = availability.findIndex(Boolean);
  if (availableIndex >= 0) return candidates[availableIndex]!;
  throw new Error(
    `Could not find the noVNC UI assets. Looked in:\n${candidates.map((candidate) => `- ${candidate}`).join("\n")}`,
  );
}

function hasSessionCookie(request: Request, token: string): boolean {
  return Boolean(
    request.headers
      .get("cookie")
      ?.split(";")
      .some((cookie) => cookie.trim() === `yesvnc_session=${token}`),
  );
}

function sessionCookie(token: string): string {
  return `yesvnc_session=${token}; HttpOnly; SameSite=Strict; Path=/`;
}

async function staticAssetResponse(
  root: string,
  pathname: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const assetPath = resolve(root, `.${pathname}`);
  const relativePath = relative(root, assetPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return new Response("Not found", { status: 404 });
  }

  const file = Bun.file(assetPath);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  return new Response(file, {
    headers: {
      "cache-control": "no-cache",
      "content-type": contentType(assetPath),
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

function contentType(path: string): string {
  switch (extname(path)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".mp3":
      return "audio/mpeg";
    case ".oga":
      return "audio/ogg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".ttf":
      return "font/ttf";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

const DYNAMIC_RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

const NOVNC_CONTENT_SECURITY_POLICY =
  "default-src 'self'; connect-src 'self' ws:; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'";

function htmlResponse() {
  return new Response(VIEWER_HTML, {
    headers: {
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'self'; connect-src 'self' ws:; style-src 'unsafe-inline'; img-src 'self' data:",
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
  });
}

const VIEWER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>yesVNC</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      html, body, #screen { width: 100%; height: 100%; margin: 0; }
      body { overflow: hidden; background: #090b0e; color: #f7f7f4; }
      #screen { display: flex; align-items: center; justify-content: center; }
      #screen canvas { outline: none; }
      .bar { position: fixed; z-index: 10; top: 14px; left: 50%; display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 6px 8px 6px 14px; transform: translateX(-50%); border: 1px solid rgba(255,255,255,.13); border-radius: 14px; background: rgba(18,20,24,.82); box-shadow: 0 12px 40px rgba(0,0,0,.35); backdrop-filter: blur(18px); }
      .dot { width: 8px; height: 8px; border-radius: 99px; background: #efb346; box-shadow: 0 0 0 4px rgba(239,179,70,.12); }
      .dot[data-state="connected"] { background: #66d38e; box-shadow: 0 0 0 4px rgba(102,211,142,.12); }
      .dot[data-state="failed"], .dot[data-state="disconnected"] { background: #ee6b68; box-shadow: 0 0 0 4px rgba(238,107,104,.12); }
      .meta { min-width: 0; padding-right: 8px; }
      .name { font-size: 12px; font-weight: 650; white-space: nowrap; }
      .status { max-width: 280px; overflow: hidden; color: #989ba3; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
      button { height: 29px; padding: 0 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; background: rgba(255,255,255,.07); color: inherit; font: inherit; font-size: 11px; cursor: pointer; }
      button:hover { background: rgba(255,255,255,.12); }
      .credentials { position: fixed; z-index: 20; inset: 0; display: none; place-items: center; background: rgba(4,5,7,.68); backdrop-filter: blur(12px); }
      .credentials[data-open="true"] { display: grid; }
      form { width: min(360px, calc(100vw - 32px)); padding: 24px; border: 1px solid rgba(255,255,255,.12); border-radius: 20px; background: #14171c; box-shadow: 0 24px 80px rgba(0,0,0,.55); }
      h1 { margin: 0; font-size: 20px; letter-spacing: -.03em; }
      p { margin: 7px 0 20px; color: #989ba3; font-size: 13px; line-height: 1.5; }
      label { display: grid; gap: 6px; margin-top: 12px; color: #b8bac0; font-size: 11px; }
      input { width: 100%; height: 40px; padding: 0 12px; border: 1px solid rgba(255,255,255,.12); border-radius: 10px; outline: none; background: #0d0f13; color: white; font: inherit; }
      input:focus { border-color: #7a8cff; box-shadow: 0 0 0 3px rgba(122,140,255,.14); }
      form button { width: 100%; height: 40px; margin-top: 18px; background: #f3f3ef; color: #0b0c0f; font-weight: 700; }
      @media (max-width: 600px) { .bar { top: 8px; max-width: calc(100vw - 16px); } .status { max-width: 130px; } #reconnect { display: none; } }
    </style>
  </head>
  <body>
    <div class="bar">
      <span id="dot" class="dot"></span>
      <div class="meta"><div id="name" class="name">yesVNC</div><div id="status" class="status">Starting…</div></div>
      <button id="reconnect" type="button">Reconnect</button>
      <button id="fullscreen" type="button">Full screen</button>
    </div>
    <div id="screen"></div>
    <div id="credentials" class="credentials">
      <form id="credentials-form">
        <h1>Authentication required</h1>
        <p>Credentials are sent directly to this VNC server and are not saved by yesVNC.</p>
        <label id="username-label">Username<input id="username" autocomplete="username" /></label>
        <label>Password<input id="password" type="password" autocomplete="current-password" autofocus /></label>
        <button type="submit">Connect</button>
      </form>
    </div>
    <script type="module" src="/viewer.js"></script>
  </body>
</html>`;
