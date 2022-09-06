#!/usr/bin/env bash
set -euo pipefail
shopt -s inherit_errexit

export NODE_ENV=production

SCRIPTPATH="$(cd "$(dirname "$0")" >/dev/null 2>&1; pwd -P)"
cd "$SCRIPTPATH"/../

rm -rf ./prod/*
yarn webpack --config ./webpack.production.config.js --progress=profile --color "$@"
yarn babel -D -d prod/app --extensions .js,.ts,.tsx --ignore ./**/specs/* app
yarn babel -D -d prod/ message.js
yarn babel -D -d prod/database --extensions .js,.ts,.tsx database
yarn babel -D -d prod/scripts --extensions .js,.ts,.tsx scripts

cp ./server.js ./prod/server.js
cp ./package.json ./prod/package.json
yarn install --production=true --modules-folder=./prod/node_modules
mkdir ./prod/log
mkdir ./prod/uploaded_documents
mkdir ./prod/temporal_files
mkdir ./prod/custom_uploads
cp -r public ./prod
