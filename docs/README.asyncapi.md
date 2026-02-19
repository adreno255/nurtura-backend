# Nurtura AsyncAPI Documentation

This directory contains AsyncAPI 3.0 specification documents for Nurtura's real-time communication protocols.

## Contents

1. **asyncapi-mqtt.yaml** - MQTT protocol for ESP32 ↔ Backend communication
2. **asyncapi-websocket.yaml** - WebSocket protocol for Backend ↔ Client communication

## Overview

### Architecture

```
┌─────────────┐         MQTT           ┌─────────────┐       WebSocket      ┌───────────────┐
│   ESP32     │ ◄────────────────────► │   Backend   │ ◄──────────────────► │  Clients      │
│   Devices   │    (asyncapi-mqtt)     │   Server    │  (asyncapi-websocket)│  (Mobile App) │
└─────────────┘                        └─────────────┘                      └───────────────┘
      │                                       │                                     │
      │  - Sensor readings                    │  - Process data                     │  - Real-time UI
      │  - Device status                      │  - Automation rules                 │  - Notifications
      │  - Error reports                      │  - Database storage                 │  - Monitoring
      │                                       │  - Command dispatch                 │
      │  ◄─ Control commands                  │                                     │
```

### Message Flow

1. **Sensor Data Flow (MQTT → WebSocket)**

    ```
    ESP32 → MQTT (sensors topic) → MqttService.routeMessage()
    → SensorsService.processSensorData() → Database
    → AutomationService.evaluateRules() [optional]
    → WebsocketService.broadcastSensorData() → WebSocket clients
    ```

2. **Command Flow (HTTP/WebSocket → MQTT)**

    ```
    Client → HTTP API / WebSocket → AutomationService
    → MqttService.publishCommand() → MQTT (commands topic) → ESP32
    ```

3. **Device Status Flow**
    ```
    ESP32 → MQTT (status topic) → RacksService.processDeviceStatus()
    → Database → WebsocketService.broadcastDeviceStatus() → Clients
    ```

## Using the Documentation

### 1. Viewing the Specs

#### Option A: AsyncAPI Studio (Online)

1. Go to https://studio.asyncapi.com/
2. Click "Import" → "From File"
3. Upload `asyncapi-mqtt.yaml` or `asyncapi-websocket.yaml`
4. Explore the interactive documentation

#### Option A: AsyncAPI Studio (Online) ALTERNATIVE

##### If "Import From File" did not work, do this:

1. Go to https://studio.asyncapi.com/
2. Copy content of `asyncapi-mqtt.yaml` or `asyncapi-websocket.yaml`
3. Past the content in the workspace of AsyncAPI Studio
4. Explore the interactive documentation

#### Option B: VS Code Extension

1. Install "AsyncAPI Preview" extension
2. Open `.yaml` file
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type "AsyncAPI: Preview" (make sure that search bar has ">")

## Security Considerations

### MQTT

- **Production**: Use TLS (port 8883)
- **Authentication**: Username/password per device
- **Authorization**: Topic-based ACLs (devices can only publish to their own topics)

### WebSocket

- **Production**: Use WSS (TLS)
- **Authentication**: Firebase JWT token validation
- **Authorization**: User can only subscribe to their own racks

## Integration with API Documentation

These AsyncAPI specs complement the OpenAPI/Swagger documentation for HTTP REST endpoints:

- **OpenAPI (Swagger)**: HTTP REST API - `http://localhost:3000/api/docs`
- **AsyncAPI (MQTT)**: MQTT protocol - `asyncapi-mqtt.yaml`
- **AsyncAPI (WebSocket)**: WebSocket protocol - `asyncapi-websocket.yaml`
