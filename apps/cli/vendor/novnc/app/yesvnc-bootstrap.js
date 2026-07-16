// Copyright (c) 2026 851 Labs
// SPDX-License-Identifier: MIT

import UI from "./ui.js";
import * as Log from "../core/util/logging.js";

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

UI.start({ settings: { defaults, mandatory } });
