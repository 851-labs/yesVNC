/* oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-parameters */
import RFB from "@novnc/novnc";

interface SessionConfig {
  host: string;
  name: string;
  password?: string;
  port: number;
  username?: string;
  viewOnly?: boolean;
}

const screen = element<HTMLDivElement>("screen");
const status = element<HTMLDivElement>("status");
const name = element<HTMLDivElement>("name");
const dot = element<HTMLSpanElement>("dot");
const credentials = element<HTMLDivElement>("credentials");
const credentialsForm = element<HTMLFormElement>("credentials-form");
const usernameInput = element<HTMLInputElement>("username");
const passwordInput = element<HTMLInputElement>("password");
const usernameLabel = element<HTMLLabelElement>("username-label");
const token = new URLSearchParams(location.search).get("token");

if (!token) throw new Error("Missing session token");

const session = (await fetch(`/session.json?token=${encodeURIComponent(token)}`, {
  cache: "no-store",
}).then((response) => {
  if (!response.ok) throw new Error("This yesVNC session is no longer available");
  return response.json();
})) as SessionConfig;

name.textContent = session.name;
document.title = `${session.name} — yesVNC`;
usernameInput.value = session.username ?? "";

let rfb: RFB | undefined;

function connect() {
  rfb?.disconnect();
  screen.replaceChildren();
  setStatus("connecting", `Connecting to ${session.host}:${session.port}…`);

  const websocketProtocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${websocketProtocol}//${location.host}/socket?token=${encodeURIComponent(token!)}`;
  rfb = new RFB(screen, url, {
    credentials: {
      password: session.password ?? "",
      username: session.username ?? "",
    },
    shared: true,
  });
  rfb.scaleViewport = true;
  rfb.resizeSession = true;
  rfb.showDotCursor = true;
  rfb.viewOnly = session.viewOnly ?? false;
  rfb.background = "#090b0e";
  rfb.addEventListener("connect", () => {
    credentials.dataset.open = "false";
    setStatus("connected", session.viewOnly ? "Connected · view only" : "Connected");
  });
  rfb.addEventListener("disconnect", (event) => {
    const clean = (event as CustomEvent<{ clean: boolean }>).detail.clean;
    setStatus("disconnected", clean ? "Disconnected" : "Connection lost");
  });
  rfb.addEventListener("credentialsrequired", (event) => {
    const types = (event as CustomEvent<{ types: string[] }>).detail.types;
    usernameLabel.hidden = !types.includes("username") && !session.username;
    credentials.dataset.open = "true";
    passwordInput.focus();
  });
  rfb.addEventListener("securityfailure", (event) => {
    const reason = (event as CustomEvent<{ reason?: string }>).detail.reason;
    setStatus("failed", reason ?? "Authentication failed");
    credentials.dataset.open = "true";
    passwordInput.select();
  });
  rfb.addEventListener("desktopname", (event) => {
    const desktopName = (event as CustomEvent<{ name: string }>).detail.name;
    if (desktopName) name.textContent = desktopName;
  });
}

credentialsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  rfb?.sendCredentials({
    password: passwordInput.value,
    username: usernameInput.value,
  });
  passwordInput.value = "";
  credentials.dataset.open = "false";
  setStatus("connecting", "Authenticating…");
});

element<HTMLButtonElement>("reconnect").addEventListener("click", connect);
element<HTMLButtonElement>("fullscreen").addEventListener("click", () => {
  void document.documentElement.requestFullscreen();
});
window.addEventListener("beforeunload", () => rfb?.disconnect());

connect();

function setStatus(state: string, message: string) {
  dot.dataset.state = state;
  status.textContent = message;
}

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing #${id}`);
  return value as T;
}
