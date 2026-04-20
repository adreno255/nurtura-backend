# Nurtura API

> The automated indoor urban farming platform API – manage plants, sensors, and automation for soil-based growing systems

## About

Nurtura is a comprehensive IoT and automation system designed for modern plant cultivation. The API provides real-time management and control of:

- **🌱 Plant Management** – Track plant categorization and plant care across growing environments
- **📊 Sensor Integration** – Monitor environmental conditions (temperature, humidity, soil moisture, and light intensity levels) in real-time
- **🔌 Hardware Control** – Manage growing racks, pumps, and actuators through MQTT and WebSocket communication
- **⚙️ Smart Automation** – Create custom rules to automate environmental controls based on sensor data and schedules
- **🔔 Notifications** – Real-time alerts for critical events and system status changes
- **👤 User Management** – Secure Firebase authentication with role-based access control
- **📧 Email Integration** – Guranteed OTP delivery for verification

**Built with:** [NestJS](https://nestjs.com/) • TypeScript • PostgreSQL • Prisma • Firebase

## Project setup

```bash
$ npm install

$ npx prisma generate
```

## Compile and run the project

```bash
# staging
$ npm run start

# development watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# test coverage
$ npm run test:cov
```

## Architecture

The API uses a modular NestJS architecture with the following core modules:

- **Auth Module** – Firebase authentication and authorization
- **Users Module** – User profiles and account management
- **Plants Module** – Plant data and plant care activity tracking
- **Sensors Module** – Sensor readings and data collection
- **Racks Module** – Growing environment management
- **Automation Module** – Rule creation and execution engine
- **Notifications Module** – Event-driven alerting system
- **MQTT Module** – IoT device communication and control
- **WebSocket Module** – Real-time data streaming to connected clients
- **System Rules Module** – Environmental automation and scheduling

## Environment Setup

Create environment files for your deployment:

```bash
# Test
.env.test

# Development
.env.development

# Staging
.env.staging

# Production
.env.production
```

Required variables:

- `DATABASE_URL` – PostgreSQL connection string
- `FIREBASE_*` – Firebase configuration
- `MQTT_*` – MQTT broker credentials
- `SENDGRID_*` – Email service credentials

## Local Development with Docker

The project includes Docker Compose configurations for local development:

```bash
# Start services (API, PostgreSQL, MQTT broker)
docker-compose up -d

# Or for staging environment
docker-compose -f docker-compose.staging.yml up -d
```

## Database

Manage migrations with Prisma:

```bash
# Create a new migration
npx prisma migrate dev --name describe_changes

# Apply migrations
npx prisma migrate deploy

# View database in Prisma Studio
npm run prisma:studio

# Reset database (development only)
npx prisma migrate reset
```

## Documentation

Swagger API documentation is available at `/api/docs` when running in development mode.

Async API documentation:

- [MQTT Documentation](./docs/asyncapi-mqtt.yml)
- [WebSocket Documentation](./docs/asyncapi-websocket.yml)

## License

UNLICENSED
