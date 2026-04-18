#!/bin/sh
cd "$(dirname "$0")"
python3 bmc_edit/server.py "$@"
