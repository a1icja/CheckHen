# CheckHen

CheckHen is a web application designed for managing class sessions, student check-ins, and real-time communication using Clerk for authentication and Prisma for database management.

## Table of Contents
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
  - [Development Mode](#development-mode)
  - [Production Mode](#production-mode)
  - [Running on a Raspberry Pi](#running-on-a-raspberry-pi)
- [Pages Overview](#pages-overview)

---

## Setup

### Prerequisites
1. Install [Node.js](https://nodejs.org/) (v18 or higher).
2. Install [Yarn](https://yarnpkg.com/) (v4 or higher).
3. Install [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/checkhen.git
   cd checkhen
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Set up a Clerk account:
   - Go to [Clerk](https://clerk.dev/) and create an account.
   - Create a new Clerk application.
   - Obtain your **Publishable Key** and **Secret Key** from the Clerk dashboard.

---

## Environment Variables

Create a `.env.local` file in the `checkhen` directory with the following variables:

- `DATABASE_URL`: Connection string for the PostgreSQL database.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key for frontend authentication.
- `CLERK_SECRET_KEY`: Clerk secret key for backend authentication.
- `NEXT_PUBLIC_EMAIL_DOMAIN`: Allowed email domain for user authentication.
- `NEXT_PUBLIC_ADMIN_EMAILS`: Comma-separated list of admin email prefixes.

Example:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
NEXT_PUBLIC_EMAIL_DOMAIN=bu.edu
NEXT_PUBLIC_ADMIN_EMAILS=alicja,langd0n,pawel
```

---

## Running the Project

### Development Mode (Using `yarn`)
1. Set up the database:
   - Ensure Docker is running.
   - Start the database using Docker Compose:
     ```bash
     docker-compose up -d db
     ```
   - Run Prisma migrations:
     ```bash
     yarn prisma migrate dev
     ```

2. Start the development server:
   ```bash
   yarn dev
   ```
3. The application will be available at `http://localhost:3000`.

4. To stop the development server, press `Ctrl+C`.

---

### Production Mode (Using `docker compose`)
1. Run the GitHub workflow to build the CheckHen image with the required environment variables
2. Edit `docker-compose.yml` to reference the image tag you created.

1. Build and start the application:
   ```bash
   docker-compose up
   ```
2. The application will be available at `http://localhost:3000`.

3. To stop the application, run:
   ```bash
   docker-compose down
   ```

---

### Running on a Raspberry Pi

You can run CheckHen on a Raspberry Pi 3B+ or better. This setup requires a USB WiFi dongle that supports AP mode and a USB power supply.

#### Prerequisites
1. A Raspberry Pi 3B+ or better.
2. A USB WiFi dongle that supports AP mode.
3. A USB power supply for the Raspberry Pi.
4. A microSD card with Raspberry Pi OS installed.

#### Steps
1. **Set up RaspAP**:
   - Install RaspAP by following the instructions on the [RaspAP website](https://docs.raspap.com/).
   - Configure RaspAP as a WiFi repeater:
     - Connect the Raspberry Pi to your primary WiFi network.
     - Use the USB WiFi dongle to create an access point (AP) for clients to connect to.

2. **Install Docker and Docker Compose**:
   - Update the Raspberry Pi:
     ```bash
     sudo apt update && sudo apt upgrade -y
     ```
   - Install Docker:
     ```bash
     curl -fsSL https://get.docker.com -o get-docker.sh
     sudo sh get-docker.sh
     ```
   - Add the `pi` user to the Docker group:
     ```bash
     sudo usermod -aG docker pi
     ```
     Log out and back in for the changes to take effect.
   - Install Docker Compose:
     ```bash
     sudo apt install -y docker-compose
     ```

3. **Run CheckHen**:
   - Clone the repository:
     ```bash
     git clone https://github.com/your-repo/checkhen.git
     cd checkhen
     ```
   - Follow the instructions in the [Production Mode](#production-mode) section to build and start the application using Docker Compose.

4. **Access the Application**:
   - Connect a client device to the Raspberry Pi's WiFi network.
   - Open a browser and navigate to `https://checkhen.com`. This domain will always point to the Raspberry Pi when connected to the RaspAP network.

#### Using Pi-hole for Website Blocking

You can use Pi-hole to block all websites except a few whitelisted ones, ensuring that users connected to the Raspberry Pi's network can only access specific domains.

1. **Install Pi-hole**:
   - Follow the official installation guide on the [Pi-hole website](https://pi-hole.net/).

2. **Configure Pi-hole**:
   - Access the Pi-hole admin interface (usually at `http://<raspberry-pi-ip>/admin`).
   - Go to the "Group Management" > "Domains" section.
   - Add the domains you want to whitelist (e.g., `checkhen.com`, `clerk.dev`, etc.) under the "Whitelist" tab.

3. **Block All Other Domains**:
   - Go to the "Group Management" > "Domains" section.
   - Add `*` (wildcard) under the "Blacklist" tab to block all other domains.

4. **Set Pi-hole as the DHCP and DNS Server**:
   - In the Pi-hole admin interface, go to "Settings" > "DHCP".
   - Enable the DHCP server and configure the IP range for your network.
   - Save the changes.
   - Disable the DHCP server in RaspAP:
     - Access the RaspAP admin interface (usually at `http://10.3.141.1`).
     - Go to "Networking" > "DHCP Server" and disable the DHCP server.
     - Save the changes and restart the RaspAP service.

5. **Test the Configuration**:
   - Reconnect client devices to the Raspberry Pi's WiFi network.
   - Verify that only the whitelisted websites are accessible.

---

## Pages Overview

### Public Pages
- **Home (`/`)**: Displays the current class session, allows students to raise their hand, and provides a chat interface.
- **Chat (`/chat`)**: Displays the chat interface for students.

### Admin Pages
- **Dashboard (`/admin/dashboard`)**: Allows admins to manage class sessions, view raised hands, and check-in data.
- **Chat (`/admin/chat`)**: Displays the chat interface for admins to monitor messages.

### API Endpoints
- **Student APIs**:
  - `/api/student/check-in`: Handles student check-ins.
  - `/api/student/fetch-check-in`: Fetches check-in data for a student.
  - `/api/student/send-chat`: Sends a chat message.
  - `/api/student/fetch-all-chat`: Fetches all chat messages.
  - `/api/student/fetch-last-chat`: Fetches the latest chat message.
  - `/api/student/toggle-vhr`: Toggles the "raise hand" status.
  - `/api/student/fetch-hand-raise`: Fetches the student's hand-raise status.

- **Admin APIs**:
  - `/api/admin/start-new-class`: Starts a new class session.
  - `/api/admin/end-class-early`: Ends the current class session early.
  - `/api/admin/fetch-check-ins`: Fetches all check-ins for the current class.
  - `/api/admin/fetch-hand-raise`: Fetches all raised hands for the current class.
  - `/api/admin/ack-hand-raise`: Acknowledges a raised hand.
  - `/api/admin/rate-hand-raise`: Rates a raised hand as productive or not.
  - `/api/admin/fetch-all-chat`: Fetches all chat messages for the current class.
  - `/api/admin/fetch-last-chat`: Fetches the latest chat message for the current class.

---

## Additional Notes

- **Socket Server**: The project includes a socket server for real-time updates. Ensure the socket server is running on port `6060` as defined in `docker-compose.yml`.
- **Grafana**: A Grafana instance is included for monitoring and analytics. Access it at `http://localhost:3001` with default credentials (`admin:admin`).

### Known Issues
1. **Admin Dashboard Socket Connection**: The admin dashboard requires a manual refresh to ensure the socket connects properly.
2. **Grafana Datasource UID**: The Grafana instance assigns a random UID to the datasource, which prevents the dashboard from locating it correctly.
