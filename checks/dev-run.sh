#!/bin/sh
# Cargo runs every binary it builds through this (see .cargo/config.toml).
#
# On macOS the keychain decides whether an app may read a saved sign-in by who signed the app.
# A debug build is signed "ad hoc", which changes with every build, so each rebuild of the
# desktop app was a stranger to the keychain and asked for the login password again, once per
# saved sign-in. Signing the debug app with a real certificate under one fixed name makes
# "Always Allow" last across rebuilds.
#
# It only happens for a developer who asks for it: put the name of a signing certificate from
# `security find-identity -v -p codesigning` in a file called .dev-sign at the top of the repo.
# The file is ignored by git. Without it, nothing here changes anything.
bin="$1"
root="$(cd "$(dirname "$0")/.." && pwd)"
case "$bin" in
  */lokus-desktop)
    if [ -s "$root/.dev-sign" ]; then
      codesign --force --sign "$(head -1 "$root/.dev-sign")" --identifier io.lokus.app.dev "$bin" >/dev/null 2>&1 \
        || echo "dev-run: could not sign $bin with the certificate named in .dev-sign; running it unsigned" >&2
    fi
    ;;
esac
exec "$@"
