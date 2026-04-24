#!/bin/bash

set -e

ADB_BIN="${HOME}/Library/Android/sdk/platform-tools/adb"
EMULATOR_BIN="${HOME}/Library/Android/sdk/emulator/emulator"
AVD_NAME="${ANDROID_EMULATOR_NAME:-Medium_Phone_API_36.1}"

if [ -x "$EMULATOR_BIN" ]; then
  "$EMULATOR_BIN" "@${AVD_NAME}" >/dev/null 2>&1 &
fi

if [ -x "$ADB_BIN" ]; then
  "$ADB_BIN" wait-for-device
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/start-expo.sh" --android
