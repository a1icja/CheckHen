# Socket Server

The `socket-server` is a real-time communication service for the CheckHen application. It uses `Socket.IO` to handle WebSocket connections and `Prisma` for database interactions.

## Features

- Handles real-time communication between clients.
- Manages user check-ins and hand-raise events.
- Stores user data in a PostgreSQL database using Prisma.

## Prerequisites

- Node.js (v18 or higher)
- Yarn (v4 or higher)
- PostgreSQL database
- Prisma CLI

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/checkhen.git
   cd checkhen/socket-server
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Set up the database:
   - Ensure PostgreSQL is running.
   - Update the `DATABASE_URL` in the `.env` file with your database connection string.

4. Generate Prisma client:
   ```bash
   yarn prisma generate
   ```

## Running the Server

### Development Mode
Start the server in development mode:
```bash
yarn dev
```

### Production Mode
Build and start the server:
```bash
yarn build
node dist/index.js
```

## Environment Variables

The following environment variables are required:

- `DATABASE_URL`: Connection string for the PostgreSQL database.

## API Overview

The socket server listens for WebSocket connections on port `6060`. It handles the following events:

- **User Connection**: Authenticates and registers users.
- **Check-In**: Logs user attendance for a class.
- **Hand Raise**: Tracks when a user raises their hand.

## Deployment

The `Dockerfile` provided can be used to containerize the service. Build and run the container using Docker:
```bash
docker build -t socket-server .
docker run -p 6060:6060 --env-file .env socket-server
```
