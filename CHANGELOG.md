## [1.0.1](https://github.com/adreno255/nurtura-backend/compare/v1.0.0...v1.0.1) (2026-02-19)

### Bug Fixes

* bug in build docker workflow ([fa4b176](https://github.com/adreno255/nurtura-backend/commit/fa4b176e981f31752548a1ddef685107f165736b))

## 1.0.0 (2026-02-19)

### ⚠ BREAKING CHANGES

* change user endpoint urls
* change OTP generation to server-side

### Features

* add API server entry endpoint ([81df823](https://github.com/adreno255/nurtura-backend/commit/81df823bdbe11aca11bb0c03cb06376d826bd22c))
* add auth email service ([33f247f](https://github.com/adreno255/nurtura-backend/commit/33f247f708055beeef1706d37b5e1590184e5989))
* add automation module draft ([8e0e1ad](https://github.com/adreno255/nurtura-backend/commit/8e0e1adc45ed223aaa058007d89fa962bb0170d9))
* add Firebase JWT authorization ([df9bd30](https://github.com/adreno255/nurtura-backend/commit/df9bd305456b9241b1944b7ff2dc48ac0aeda129))
* add mqtt and ws modules ([bbedb70](https://github.com/adreno255/nurtura-backend/commit/bbedb70103accca0fc815612c3caa6ead96d3118))
* add racks module ([d7e1cca](https://github.com/adreno255/nurtura-backend/commit/d7e1ccadb03d7ae2c9e8360bf52a9eddf1068f57))
* add remaining auth endpoints ([7bfd999](https://github.com/adreno255/nurtura-backend/commit/7bfd9991d9fc38765d43c5c1b67208f7ae6bd770))
* add user endpoints ([f4c0b67](https://github.com/adreno255/nurtura-backend/commit/f4c0b67e337eb3daab5bb93659cfba66501c9634))
* add user update and reset email ([373cf7d](https://github.com/adreno255/nurtura-backend/commit/373cf7d8afb64e7c32402db5a0928e94c53a9c43))

### Bug Fixes

* change id to firebaseUid when checking onboarding status ([3247bd4](https://github.com/adreno255/nurtura-backend/commit/3247bd4823c152fe9156331b8d9f83031c917882))
* database connection in database service ([ea79ca7](https://github.com/adreno255/nurtura-backend/commit/ea79ca706c94933a745f8e338061794b97f42340))
* email reset otp bugs ([c3e6038](https://github.com/adreno255/nurtura-backend/commit/c3e60380a9505462ff3cb42b2b71e33d66897d55))
* fix bugs in cicd workflows ([062f591](https://github.com/adreno255/nurtura-backend/commit/062f59187178e5adc8b8e4464f646097fd563762))
* otp expiry time not in correct format ([076bbc9](https://github.com/adreno255/nurtura-backend/commit/076bbc98c3e1d2d520f49bddea9c660580d1342e))
* semantic release workflow bugs ([746ee81](https://github.com/adreno255/nurtura-backend/commit/746ee81f151a932f70db2799bf1ed04ad4582854))
* unknown authentication strategy "firebase-jwt" error ([501b5c8](https://github.com/adreno255/nurtura-backend/commit/501b5c8a67ae786ce576564c88a97588a357bed9))

### Code Refactoring

* add common folder for shared code ([1dcdccf](https://github.com/adreno255/nurtura-backend/commit/1dcdccf936dc489559465a4a85d189300e9e5fd3))
* add iot sensor models in schema ([ac74be1](https://github.com/adreno255/nurtura-backend/commit/ac74be1f059cfe33fe39a23c3f2a71216c6582e6))
* change OTP generation to server-side ([5761869](https://github.com/adreno255/nurtura-backend/commit/57618698e8c027fd520cddad03aea1fa0f0dece1))
* change user endpoint urls ([e37ad55](https://github.com/adreno255/nurtura-backend/commit/e37ad55398133252a72966370a41f0eea2af4405))
* exception filter error logging ([6d461b5](https://github.com/adreno255/nurtura-backend/commit/6d461b5792e2174f64226b70fadeb97a4c0779b5))
* improve websocket gateway module ([4585bfd](https://github.com/adreno255/nurtura-backend/commit/4585bfd3065538bca927cbd273d8ee96762a2934))
* make app host environment-safe ([d062473](https://github.com/adreno255/nurtura-backend/commit/d062473d8f2239a1008f349c0f4d94d675a75fa0))
* make auth endpoints' response to interfaces ([5042ca2](https://github.com/adreno255/nurtura-backend/commit/5042ca2f47ade7e3704ac6597bbf64bdff7f79e3))
* refactor prisma schema ([52a4c9b](https://github.com/adreno255/nurtura-backend/commit/52a4c9bff675ca4389eae4dc5f86c56ad6406b0b))
* separate bootsrap and app logs ([f36fccd](https://github.com/adreno255/nurtura-backend/commit/f36fccdcbffc0d89f2087d8e163bb775e7153136))
* separate responsibility to correct modules ([2f7f2cb](https://github.com/adreno255/nurtura-backend/commit/2f7f2cb33971e01ac408511d9a99492a5b9bfdb4))
