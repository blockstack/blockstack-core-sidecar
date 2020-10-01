## [0.22.1](https://github.com/blockstack/stacks-blockchain-api/compare/v0.22.0...v0.22.1) (2020-10-01)


### Bug Fixes

* lint issues ([87aa514](https://github.com/blockstack/stacks-blockchain-api/commit/87aa514a343131ea14b17fb69cbef5a6374e5744))
* place all rosetta tests in one file ([0eda451](https://github.com/blockstack/stacks-blockchain-api/commit/0eda451ddc30138ad44f526eb5146b262a0e5b41))
* typos and add check signer in parse test ([839a409](https://github.com/blockstack/stacks-blockchain-api/commit/839a4094629af8d9db6fa30472a0e0de79924cda))
* used stacks-transaction for testing parse api ([6765cde](https://github.com/blockstack/stacks-blockchain-api/commit/6765cde716f89af0426d0996713c5422ac1a2c3e))

# [0.22.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.21.0...v0.22.0) (2020-09-25)


### Features

* add rosetta construction/hash endpoin implementation ([b9f4ff6](https://github.com/blockstack/stacks-blockchain-api/commit/b9f4ff6bb9107caf1ce450698c2ee1b8b1aa27c7))
* add rosetta construction/metadata implementation ([b60b30e](https://github.com/blockstack/stacks-blockchain-api/commit/b60b30e7fbf5f0d4ac4d72c86ffb77f613f4fe46))

# [0.21.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.20.0...v0.21.0) (2020-09-25)


### Features

* add follower-mode vscode debug config ([f07bc57](https://github.com/blockstack/stacks-blockchain-api/commit/f07bc57553a89681ab0f188d34c9354a8910ad41))

# [0.20.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.19.0...v0.20.0) (2020-09-25)


### Features

* add pox endpoint ([d4e6966](https://github.com/blockstack/stacks-blockchain-api/commit/d4e6966aa4d18409d127ab916144511b901bb192))
* adding generated client libs for pox proxy ([2a4aa5a](https://github.com/blockstack/stacks-blockchain-api/commit/2a4aa5a0843cd0090b32820fa3ede6a046a8634f))

# [0.19.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.18.1...v0.19.0) (2020-09-24)


### Features

* update client to match new openapi spec ([bba888c](https://github.com/blockstack/stacks-blockchain-api/commit/bba888ca294efacd57c6a5dd823068da2415c093))

## [0.18.1](https://github.com/blockstack/stacks-blockchain-api/compare/v0.18.0...v0.18.1) (2020-09-24)


### Bug Fixes

* support new Clarity string types [#223](https://github.com/blockstack/stacks-blockchain-api/issues/223) ([2c8669b](https://github.com/blockstack/stacks-blockchain-api/commit/2c8669b1f6692bb15c8838816cc8b107034a9da2))

# [0.18.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.17.0...v0.18.0) (2020-09-24)


### Features

* noop handler for STXLockEvent, _should_ ignore event rather than reject ([b02985c](https://github.com/blockstack/stacks-blockchain-api/commit/b02985c5f7c6afc0ed93378f512daafe18e5907e))

# [0.17.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.16.0...v0.17.0) (2020-09-24)


### Features

* cool down: from 2 days to 1 hour ([c6f4924](https://github.com/blockstack/stacks-blockchain-api/commit/c6f4924f56ecf211184e072271983632197757ca))

# [0.16.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.15.0...v0.16.0) (2020-09-22)


### Bug Fixes

* build issues with prom libs ([bb38998](https://github.com/blockstack/stacks-blockchain-api/commit/bb38998f7cb323f853b4f1707f661c14a766c19a))
* use import instead of require ([798e44a](https://github.com/blockstack/stacks-blockchain-api/commit/798e44a670634054037f06213e7fda309a2fdde5))


### Features

* add prometheus metrics endpoint ([ce9cbe9](https://github.com/blockstack/stacks-blockchain-api/commit/ce9cbe94d40a8f60de05ae9b81282fb213c70ce0))

# [0.15.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.14.4...v0.15.0) (2020-09-22)


### Features

* add functionality for rosetta construction/preprocess endpoint ([f9bcbe4](https://github.com/blockstack/stacks-blockchain-api/commit/f9bcbe4760d52b86be9c84a8ee6e226b7c3275f4))

## [0.14.4](https://github.com/blockstack/stacks-blockchain-api/compare/v0.14.3...v0.14.4) (2020-09-16)


### Bug Fixes

* derive address from specific network ([342cce9](https://github.com/blockstack/stacks-blockchain-api/commit/342cce9cde158c34a224e0f3a6914f97b84d0c6b))

## [0.14.3](https://github.com/blockstack/stacks-blockchain-api/compare/v0.14.2...v0.14.3) (2020-09-15)


### Bug Fixes

* pagination and proof params in openapi spec ([4363ffe](https://github.com/blockstack/stacks-blockchain-api/commit/4363ffe7ef503c94d47d68150393e8aa9258ce3d)), closes [#222](https://github.com/blockstack/stacks-blockchain-api/issues/222)
* string array enum ([50f16ff](https://github.com/blockstack/stacks-blockchain-api/commit/50f16ff0a2d2b9ddc10128f12bfbe80afb3e0acf))

## [0.14.2](https://github.com/blockstack/stacks-blockchain-api/compare/v0.14.1...v0.14.2) (2020-09-12)


### Bug Fixes

* **client:** add readOnlyFunctionArgs ([3258dcf](https://github.com/blockstack/stacks-blockchain-api/commit/3258dcf59b0a33fe1591d45d387537adc115d7c5))

## [0.14.1](https://github.com/blockstack/stacks-blockchain-api/compare/v0.14.0...v0.14.1) (2020-09-10)


### Bug Fixes

* [#229](https://github.com/blockstack/stacks-blockchain-api/issues/229) standalone docker image starts stacks-node twice ([26692b3](https://github.com/blockstack/stacks-blockchain-api/commit/26692b37442c27814c70a244d5c88853a73ec2e5))

# [0.14.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.13.0...v0.14.0) (2020-09-08)


### Bug Fixes

* accidentally deleted the hash hexToBuffer validator check, added ([78ac061](https://github.com/blockstack/stacks-blockchain-api/commit/78ac061ca2c5e1ce022de5ca987ff760865af1de))
* missed a line while merging in the pull request ([f0f2e8d](https://github.com/blockstack/stacks-blockchain-api/commit/f0f2e8d3b04374742b3241a0c6337d8ece1373c8))
* optional property checks in /rosetta/v1/block for RosettaPartialBlockIdentifier ([35aac8f](https://github.com/blockstack/stacks-blockchain-api/commit/35aac8f6db2894ce84cdae710061ae47b1229bd1))
* remove validation middleware stub from api/init.ts ([cb64091](https://github.com/blockstack/stacks-blockchain-api/commit/cb640917e297cfe342767dff5bc968b253376f9c))
* restore "canonical = true" check in various SQL queries ([afba1a1](https://github.com/blockstack/stacks-blockchain-api/commit/afba1a1f871b430c16e7b21bc1253e8c206bf68c))
* schema changes for rosetta block and block/transaction calls ([174c4c5](https://github.com/blockstack/stacks-blockchain-api/commit/174c4c524bbc6ec08d261f66b18c0b84664517e9))
* the blockHash parameter was incorrectly named indexBlockHash ([e568ae9](https://github.com/blockstack/stacks-blockchain-api/commit/e568ae93e2a2628f420f5f9b2b5476326597747c))
* trim trailing slashes (if any) from the url in rosettaValidateRequest() ([9c211da](https://github.com/blockstack/stacks-blockchain-api/commit/9c211dabc4742360779a0094940a179ff3409e8d))
* type, reciever -> receiver ([e40a829](https://github.com/blockstack/stacks-blockchain-api/commit/e40a82923625fb1f1f5da55eda0d99100b279407))
* use http 404 for rosetta errors of the type "Not Found" for consistency ([8929334](https://github.com/blockstack/stacks-blockchain-api/commit/8929334df33bbc492e90d107f597698c708a0eed))


### Features

* add request validation code for rosetta ([c8dfb43](https://github.com/blockstack/stacks-blockchain-api/commit/c8dfb43df5070a414f7fa92fc8c32d5bb0fb4e45))
* rosetta mempool api endpoints ([90bb40c](https://github.com/blockstack/stacks-blockchain-api/commit/90bb40cfd662d6b0150bd5cb0a0f51911ca021ca))

# [0.13.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.12.0...v0.13.0) (2020-09-03)


### Features

* option to start the self-contained image in mocknet mode ([e567024](https://github.com/blockstack/stacks-blockchain-api/commit/e567024bc10f7877b8fc8d7ac548291ecf31807b))

# [0.12.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.11.3...v0.12.0) (2020-09-02)


### Features

* update jsonrc package—thanks [@zensh](https://github.com/zensh), closes [#208](https://github.com/blockstack/stacks-blockchain-api/issues/208) ([86b575d](https://github.com/blockstack/stacks-blockchain-api/commit/86b575da766f229ce971495139eae0ba68f1002b))

## [0.11.3](https://github.com/blockstack/stacks-blockchain-api/compare/v0.11.2...v0.11.3) (2020-09-01)


### Bug Fixes

* mempool schema files renamed: rosetta-mempool-transaction-list-* -> rosetta-mempool-* ([d24bfe8](https://github.com/blockstack/stacks-blockchain-api/commit/d24bfe8956f4596a143e49f45a8d25111b1c783a))
* missed several request/response files ([09e373b](https://github.com/blockstack/stacks-blockchain-api/commit/09e373b3f93f79c6089c0c791bcb9eceec60d66e))
* separate out rosetta request/response schema files from entity files ([bd4dc86](https://github.com/blockstack/stacks-blockchain-api/commit/bd4dc8649341139a2251024417bfb57805f04367))


### Reverts

* this volume change should not have been committed ([8e46a40](https://github.com/blockstack/stacks-blockchain-api/commit/8e46a40011a4ce07e4057e77966c25d692d5e068))

## [0.11.2](https://github.com/blockstack/stacks-blockchain-api/compare/v0.11.1...v0.11.2) (2020-08-27)


### Bug Fixes

* add tx_result to example ([1ce88a6](https://github.com/blockstack/stacks-blockchain-api/commit/1ce88a65d9bb8ac2df86c036b05b6af1e061aeba)), closes [#212](https://github.com/blockstack/stacks-blockchain-api/issues/212)
* adding block time ([f895fe7](https://github.com/blockstack/stacks-blockchain-api/commit/f895fe7225d3e457137bed719221047560d6ed43)), closes [#213](https://github.com/blockstack/stacks-blockchain-api/issues/213)

## [0.11.1](https://github.com/blockstack/stacks-blockchain-api/compare/v0.11.0...v0.11.1) (2020-08-27)


### Bug Fixes

* sidecar do not exit while trying to connect to postgres ([2a3c693](https://github.com/blockstack/stacks-blockchain-api/commit/2a3c693870951d512d44eb296befd48a592c2bf1))

# [0.11.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.10.0...v0.11.0) (2020-08-27)


### Bug Fixes

* add java to follower docker build ([78caee3](https://github.com/blockstack/stacks-blockchain-api/commit/78caee30e9068f8e504f88019621a6a2c71b7e8e))
* restarting services on node exit ([7f86511](https://github.com/blockstack/stacks-blockchain-api/commit/7f86511366df58e8e639cdcc97684a42f6ace312))


### Features

* dockerfile for self-contained follower ([9628148](https://github.com/blockstack/stacks-blockchain-api/commit/96281487229b6fd85d8fc5a2c75d74390a07efda))
* dockerfile with all stacks-blockchain-api dependencies working ([66d64ed](https://github.com/blockstack/stacks-blockchain-api/commit/66d64ed4e068bf6d2a500d8a6a347eff72fcc11a))
* progress on self contained follower ([d544edf](https://github.com/blockstack/stacks-blockchain-api/commit/d544edf9e3ff7769ab333b41aea11f3f472cfa2d))

# [0.10.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.9.0...v0.10.0) (2020-08-26)


### Bug Fixes

* revert test:integration script operator change ([d949119](https://github.com/blockstack/stacks-blockchain-api/commit/d949119fcaeb1ebc8fee9dd2376b168ed4409d9e))
* update readme and openapi client description ([2af816b](https://github.com/blockstack/stacks-blockchain-api/commit/2af816b4a50583f00af481be9fa748ccb41dd21d))
* windows friendly operator ([f1cd6ff](https://github.com/blockstack/stacks-blockchain-api/commit/f1cd6ff27ee5cc368fac5783a92d7682a4b4552f))


### Features

* adding docs tasks to main package.json ([6fda66c](https://github.com/blockstack/stacks-blockchain-api/commit/6fda66c3cc7dab6c250a2dbcd5980c8081623d34))
* client docs ([602a266](https://github.com/blockstack/stacks-blockchain-api/commit/602a2669e3c9ad03f75e012da386c6c1c67f77ea))

# [0.9.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.8.0...v0.9.0) (2020-08-26)


### Bug Fixes

* fetch the api server's version from package.json ([e6efc40](https://github.com/blockstack/stacks-blockchain-api/commit/e6efc40fd11a363cd2f29cbe105bb63a040b972d))


### Features

* add hard-coded status and error messages for rosetta ([84fae9b](https://github.com/blockstack/stacks-blockchain-api/commit/84fae9b7573df995ae029b152172f88a95ae6c91))
* add mempool openapi docs ([b981c49](https://github.com/blockstack/stacks-blockchain-api/commit/b981c499e6d0e0bc3fb3bf0f6049f409921746a9))
* add rosetta api schema for type information ([edb3b14](https://github.com/blockstack/stacks-blockchain-api/commit/edb3b14b597466d49674b07fee2aff615a300ad5))
* fill out rosetta network list and options calls ([a753c96](https://github.com/blockstack/stacks-blockchain-api/commit/a753c9614a9d62ad3cb6579ec36b44a4443208ad))
* stub handlers for rosetta api endpoints ([9603ea4](https://github.com/blockstack/stacks-blockchain-api/commit/9603ea4b46107e21412a2f468df0a6b966e39922))

# [0.8.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.7.0...v0.8.0) (2020-08-25)


### Bug Fixes

* deserializing multisig txs ([db6d264](https://github.com/blockstack/stacks-blockchain-api/commit/db6d264d1995aa5f872a4a8da9c34819e02e58ee))
* N-of-M multisig working ([34ba78c](https://github.com/blockstack/stacks-blockchain-api/commit/34ba78c40376a06dc161bd97b92756553a488cdd))
* N-of-N (one to one) multisig txs working ([4cc155b](https://github.com/blockstack/stacks-blockchain-api/commit/4cc155bf7ca4f2869827593a0d049f508d3f2cd7))


### Features

* initial debug endpoint support for sending multisig transactions ([d12ba53](https://github.com/blockstack/stacks-blockchain-api/commit/d12ba53fb0f1230baed3782d362b5bf3d3d9fa5b))

# [0.7.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.6.0...v0.7.0) (2020-08-24)


### Features

* expose target block time [#192](https://github.com/blockstack/stacks-blockchain-api/issues/192) ([89165b2](https://github.com/blockstack/stacks-blockchain-api/commit/89165b2becc48b9e83f92f54564434fde291a403))

# [0.6.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.5.3...v0.6.0) (2020-08-20)


### Bug Fixes

* add java to gh workflow ([d5ae6ca](https://github.com/blockstack/stacks-blockchain-api/commit/d5ae6caaa4ee9da261f67e47e0a1514ce04980f5))
* add jre to the dockerfile build ([402686c](https://github.com/blockstack/stacks-blockchain-api/commit/402686c1bfb83bbfb6c12aaa83652cce3e411719))
* client package.json files includes ([da6061f](https://github.com/blockstack/stacks-blockchain-api/commit/da6061f1cfc3ce9cf421ae18d38feac9a0950bcd))
* cross-platform openapi generation script ([7ade2fb](https://github.com/blockstack/stacks-blockchain-api/commit/7ade2fb9736943b1ba7690d8d7d3ba2eebd500d5))
* lint fixes ([465a72e](https://github.com/blockstack/stacks-blockchain-api/commit/465a72e651b6721e9e15a7065fb84235f1d99e96))
* postinstall script to build client lib if needed, add readme ([791f763](https://github.com/blockstack/stacks-blockchain-api/commit/791f763120e166bb253da093eb7cf8cf4c5e01e8))
* typing errors with esModuleInterop, default websocket client connection URL ([a1517b1](https://github.com/blockstack/stacks-blockchain-api/commit/a1517b1824d785a82adf30063723e355d575c308))


### Features

* auto-generated client demo ([6eda93d](https://github.com/blockstack/stacks-blockchain-api/commit/6eda93d7ffd4ba886c4ede489fcdf6adda830914))

## [0.5.3](https://github.com/blockstack/stacks-blockchain-api/compare/v0.5.2...v0.5.3) (2020-08-13)


### Bug Fixes

* retry npm publish ([3bda2bb](https://github.com/blockstack/stacks-blockchain-api/commit/3bda2bba4c38663aa075b8475681aa4c7cf49aa1))

## [0.5.2](https://github.com/blockstack/stacks-blockchain-api/compare/v0.5.1...v0.5.2) (2020-08-13)


### Bug Fixes

* gh-action to npm build before publishing ([40cd062](https://github.com/blockstack/stacks-blockchain-api/commit/40cd062178ab78f2940876511c9baac5f1e5df51))

## [0.5.1](https://github.com/blockstack/stacks-blockchain-api/compare/v0.5.0...v0.5.1) (2020-08-13)


### Bug Fixes

* gh-action for publishing ws-rpc-client ([544f970](https://github.com/blockstack/stacks-blockchain-api/commit/544f9704ab70ed1dd25979f8cfbb7339250bd02d))

# [0.5.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.4.0...v0.5.0) (2020-08-13)


### Bug Fixes

* remove unnecessary db tx status query from event listeners ([0a0a20d](https://github.com/blockstack/stacks-blockchain-api/commit/0a0a20dcd4b4017019ac9944f235b9ecf15568f8))


### Features

* friendlier ws-rpc-api client subscription functions ([9160039](https://github.com/blockstack/stacks-blockchain-api/commit/9160039afc3f1a674d76ccc2d87f78404adf8525))
* websocket rpc client lib ([0a67a11](https://github.com/blockstack/stacks-blockchain-api/commit/0a67a11043d83cc5aedfa2811e6fc3118e4042d6))
* websocket rpc notifications for address tx and balance updates ([14d92b0](https://github.com/blockstack/stacks-blockchain-api/commit/14d92b0ca43b7638a90eda04ed86d34e66f19097))
* websocket RPC pubsub service for real-time data services ([6eb83e8](https://github.com/blockstack/stacks-blockchain-api/commit/6eb83e8aa1cb6e5eb98c8c5ad8c94ff3954819f6))

# [0.4.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.3.1...v0.4.0) (2020-07-28)


### Bug Fixes

* linting errors after rebase with latest master ([3679652](https://github.com/blockstack/stacks-blockchain-api/commit/3679652058df3b6456ed16c0a8fc170499b2ac88))
* unit tests fixed after rebase with latest master ([a806740](https://github.com/blockstack/stacks-blockchain-api/commit/a806740cb59537cf1048a97114cec64be0daa7a9))
* unit tests for sponsored tx (redundant null property) ([c918235](https://github.com/blockstack/stacks-blockchain-api/commit/c9182357a2e52db97159c04de6b52976ca241409))


### Features

* add sponsor transaction option to debug broadcast endpoints ([4511a50](https://github.com/blockstack/stacks-blockchain-api/commit/4511a502650bc834540ea032eb476ba2b09d8d84))
* support sponsored tx in db and API response ([01703e7](https://github.com/blockstack/stacks-blockchain-api/commit/01703e7222828b6df2ed1ed0e26de3e9ae18d11e))

## [0.3.1](https://github.com/blockstack/stacks-blockchain-api/compare/v0.3.0...v0.3.1) (2020-07-28)


### Bug Fixes

* address stx balance schema bug ([b44a9b9](https://github.com/blockstack/stacks-blockchain-api/commit/b44a9b9e20329987d00a8cac90eaa7098c9de1b1))
* make address stx balance take fees into account ([f845086](https://github.com/blockstack/stacks-blockchain-api/commit/f84508668ecb6c264e9d56dfb8f29c4675b40b33))

# [0.3.0](https://github.com/blockstack/stacks-blockchain-api/compare/v0.2.5...v0.3.0) (2020-07-28)


### Bug Fixes

* possible fix for core-node proxy in gitpod deployment ([c0aaee8](https://github.com/blockstack/stacks-blockchain-api/commit/c0aaee81863150d024eb82626bee3fa61cf4a404))
* **docs:** conform to 'Response' naming convention ([735006e](https://github.com/blockstack/stacks-blockchain-api/commit/735006e58207e6bcd21ab5ce67e9bd0a0b460fdd))
* **docs:** required props, dictionary for fts, nfts ([63fe101](https://github.com/blockstack/stacks-blockchain-api/commit/63fe101b366df3f28cd554ac937a4a0bd7bea574))
* Mempool tx status to enable union type ([26feddb](https://github.com/blockstack/stacks-blockchain-api/commit/26feddb9483dbc6cae77e78837830d5fcf611baa))
* type errors in build ([c842e2b](https://github.com/blockstack/stacks-blockchain-api/commit/c842e2b4462cba24cc088f1f6f846aa403cb0756))


### Features

* add gitpod to readme ([fa5f3df](https://github.com/blockstack/stacks-blockchain-api/commit/fa5f3dfc6c9d037133cd5ec16db58d4cbcb8bd37))
* add prebuild support to gitpod config ([fe89677](https://github.com/blockstack/stacks-blockchain-api/commit/fe89677bdab1049a0057127c640a664c6fcd4741))
* gitpod support ([f89191d](https://github.com/blockstack/stacks-blockchain-api/commit/f89191d844783e37f38db76d71a6155b320c350a))
* redirect root path to status path ([2e74937](https://github.com/blockstack/stacks-blockchain-api/commit/2e749373293d6d9c0890bc574aa4a0af2f00c9eb))

# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Add CHANGELOG.md file
