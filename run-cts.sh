#!/bin/bash

set -e

REPO_URL="git@github.com:gpuweb/cts.git"
REPO_DIR="cts"
SCRIPT_TO_RUN="../tools/cts.ts"

if [ -d "$REPO_DIR" ]; then
  echo "Directory $REPO_DIR already exists. Skipping clone."
else
  echo "Cloning $REPO_URL..."
  git clone $REPO_URL $REPO_DIR
fi
cd $REPO_DIR
pwd

debug_flag=$1
if [ -z "$debug_flag" ]; then
  debug_flag="false"
fi

DEBUG=$debug_flag bun "$SCRIPT_TO_RUN" "--gpu-provider" "$(pwd)/../tools/setup.ts" "webgpu:*"