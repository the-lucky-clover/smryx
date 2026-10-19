#!/bin/sh
set -eu
if [ "$(uname -s)" != "Darwin" ]; then
  echo "Run this script on a Mac with Xcode and XcodeGen installed." >&2
  exit 1
fi
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
command -v xcodegen >/dev/null 2>&1 || { echo "Install XcodeGen first: brew install xcodegen" >&2; exit 1; }
xcrun --find swiftc >/dev/null
xcodegen generate --spec project.json
echo "Open SumystSafari.xcodeproj, select your Development Team for all five targets, and build the macOS or iOS scheme."
