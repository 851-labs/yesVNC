// Copyright (c) 2026 851 Labs
// SPDX-License-Identifier: MIT

import UI from "./ui.js";
import RFB from "../core/rfb.js";
import Cursor from "../core/util/cursor.js";
import * as Log from "../core/util/logging.js";

function installSystemFallbackCursor() {
  const systemCursorPixels = new Uint8Array();
  const changeCursor = Cursor.prototype.change;

  Cursor.prototype.change = function (rgba, hotx, hoty, width, height) {
    if (rgba === systemCursorPixels) {
      this.clear();
      this._target.style.cursor = "default";
      return;
    }

    changeCursor.call(this, rgba, hotx, hoty, width, height);
  };

  RFB.cursors.dot = {
    rgbaPixels: systemCursorPixels,
    w: 1,
    h: 1,
    hotx: 0,
    hoty: 0,
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

installSystemFallbackCursor();

UI.start({ settings: { defaults, mandatory } });
