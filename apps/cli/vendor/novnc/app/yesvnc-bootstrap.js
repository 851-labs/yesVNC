// Copyright (c) 2026 851 Labs
// SPDX-License-Identifier: MIT

import UI from "./ui.js";
import RFB from "../core/rfb.js";
import * as Log from "../core/util/logging.js";

function createFallbackCursor() {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.beginPath();
  context.moveTo(2, 1);
  context.lineTo(2, 18);
  context.lineTo(7, 13);
  context.lineTo(11, 22);
  context.lineTo(15, 20);
  context.lineTo(11, 12);
  context.lineTo(18, 12);
  context.closePath();
  context.fillStyle = "#fff";
  context.fill();
  context.lineJoin = "round";
  context.lineWidth = 2;
  context.strokeStyle = "#000";
  context.stroke();

  return {
    rgbaPixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
    w: canvas.width,
    h: canvas.height,
    hotx: 2,
    hoty: 1,
  };
}

async function loadSettings(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    Log.Error(`Couldn't fetch ${path}: ${error}`);
    return {};
  }
}

const [defaults, mandatory] = await Promise.all([
  loadSettings("./defaults.json"),
  loadSettings("./mandatory.json"),
]);

const fallbackCursor = createFallbackCursor();
if (fallbackCursor) {
  RFB.cursors.dot = fallbackCursor;
}

UI.start({ settings: { defaults, mandatory } });
