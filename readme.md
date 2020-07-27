# @blockstack/stacks-blockchain-sidecar

[![Build Status](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fblockstack%2Fstacks-blockchain-sidecar%2Fbadge%3Fref%3Dmaster&style=flat)](https://actions-badge.atrox.dev/blockstack/stacks-blockchain-sidecar/goto?ref=master)

[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/blockstack/stacks-blockchain-sidecar)

## Quick Start

First, ensure Docker is installed on your machine. 

Clone repo and install dependencies with `npm install`.

Run `npm run dev:integrated`.

This command will concurrently start the sidecar app and the service dependencies.

Check to see if the sidecar started successfully by visiting http://localhost:3999/extended/v1/status

## Local Development

### Setup Services

Then run `npm run devenv:deploy` which uses docker-compose to deploy the service dependencies (e.g. PostgreSQL, Blockstack core node, etc).

### Running the server

To run the server in 'watch' mode (restart for every code change), run `npm run dev:watch`. You'll have a server on port 3999.
