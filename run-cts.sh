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
echo "Current directory: $(pwd)"

debug_flag="false"

# Check if --debug is in the arguments
for arg in "$@"; do
  if [ "$arg" = "--debug" ]; then
    debug_flag="true"
    break
  fi
done

echo "Debug flag: $debug_flag"
echo "Script to run: $SCRIPT_TO_RUN"
echo "GPU provider path: $(realpath $(pwd)/../tools/setup.ts)"
echo "All args: $@"
echo "Full command that will be executed:"
echo "DEBUG=$debug_flag bun \"$SCRIPT_TO_RUN\" -- \"--gpu-provider\" \"$(pwd)/../tools/setup.ts\" $@"
echo ""
echo "Executing command..."

DEBUG=$debug_flag bun "$SCRIPT_TO_RUN" -- "--gpu-provider" "$(pwd)/../tools/setup.ts" $@ 