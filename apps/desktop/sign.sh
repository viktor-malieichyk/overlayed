#!/bin/bash

# run this script with
# op run --env-file .env -- ./sign.sh

# build the app
cargo tauri build --target "x86_64-pc-windows-msvc" --bundles "msi,nsis"
cargo tauri build --target "universal-apple-darwin" --bundles "dmg"

# sign
# NOTE: It seems tauri has this logic baked in
#
# codesign --force -s "$APPLE_SIGNING_IDENTITY" --options=runtime --deep src-tauri/target/release/bundle/macos/UniversalOverlay.app -v
#
# # store creds
# xcrun notarytool store-credentials "notarytool-profile" --apple-id "$APPLE_ID" --team-id="$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"
#
# # zip the app
# cd src-tauri/target/release/bundle/macos
# zip -r UniversalOverlay-aarch64-apple-darwin.zip UniversalOverlay.app
#
# # notarize the app in the zip
# xcrun notarytool submit "UniversalOverlay-aarch64-apple-darwin.zip" --keychain-profile "notarytool-profile" --wait

baseDir="src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis"
filename=$(node -p 'const { productName, version } = require("./src-tauri/tauri.conf.json"); `${productName}_${version}_x64-setup.exe`')
if [ ! -f "$baseDir/$filename" ]; then
  echo "Installer missing: $baseDir/$filename" >&2
  exit 1
fi

echo "Signing: ${filename}"
docker run -it --rm -v "./$baseDir:/code" ghcr.io/sslcom/codesigner:latest sign \
  -username=${ES_USERNAME} \
  -password=${ES_PASSWORD} \
  -credential_id=${ES_CREDENTIAL_ID} \
  -totp_secret=${ES_TOTP_SECRET} \
  -input_file_path="/code/${filename}" \
  -override=true \
  -malware_block=false
