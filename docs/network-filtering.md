# Network Filtering — CheckHen Exam Mode

This document describes the closed-internet exam setup for CheckHen running on a Raspberry Pi.

## Overview

During an exam, the Pi acts as a WiFi access point. Students connect to it and can only reach allowlisted domains (CheckHen itself and Google OAuth for sign-in). All other traffic is blocked at both the DNS layer and the IP layer.

**Why not Pi-hole?** Pi-hole was tested and crashed under classroom load on a Pi 3B+ — it runs PHP, SQLite, a lighttpd web server, and a custom DNS daemon simultaneously, which is too heavy. This setup uses bare `dnsmasq` in a Docker container (a single C binary, ~5 MB RAM) instead.

## Architecture

```
Students (WiFi)
      |
   wlan0  ← hostapd AP (exam SSID)
      |
  [Pi 3B+]
      |
   wlan1  ← two USB network extenders (uplink)
      |
  Internet (Google OAuth only — everything else FORWARD-dropped)
```

**Three enforcement layers:**

| Layer | Mechanism | What it blocks |
|---|---|---|
| DNS | dnsmasq container returns `0.0.0.0` for all non-allowlisted domains | Browser-level access |
| IP (kernel) | `iptables -P FORWARD DROP` | Students who hardcode IPs |
| OAuth pass-through | Google CIDR ranges ACCEPT'd + DNS allowlisted | Allows sign-in |

## Repo Layout

```
CheckHen/
├── docker-compose.yml       # dns service (profile: exam)
├── dns/
│   ├── dnsmasq.conf         # block-all config, bind to wlan0
│   └── allowlist.conf       # per-domain allowlist (edit this for each exam)
├── pi-setup/
│   ├── hostapd.conf         # AP config — update SSID and passphrase here
│   ├── hostapd-exam.service # systemd unit for hostapd
│   ├── exam-nat.service     # systemd unit for iptables NAT + FORWARD rules
│   ├── install.sh           # one-time Pi setup (run once after git clone)
│   ├── start-exam.sh        # start AP + NAT + dnsmasq container
│   └── stop-exam.sh         # stop everything, restore Pi to normal
└── docs/
    └── network-filtering.md # this file
```

## First-Time Setup (new Pi)

```bash
git clone <repo-url>
cd CheckHen
sudo ./pi-setup/install.sh
```

Then follow the printed instructions:
1. Edit `/etc/hostapd/hostapd-exam.conf` — set your SSID and passphrase
2. Edit `dns/allowlist.conf` — update the `checkhen.local` IP to match `wlan0`
   - Find it with: `ip addr show wlan0`

## Starting / Stopping an Exam

```bash
# Start
sudo ./pi-setup/start-exam.sh

# Stop (Pi returns to normal — no exam SSID, no filtering)
sudo ./pi-setup/stop-exam.sh
```

No keyboard or mouse needed after initial setup — SSH only.

## Editing the Allowlist

Edit [dns/allowlist.conf](../dns/allowlist.conf). Syntax:

```
# Pass a domain through to real DNS (resolved normally):
address=/example.com/#

# Resolve a domain to a specific IP (local override):
address=/checkhen.local/192.168.4.1
```

To reload without restarting the container:
```bash
docker kill --signal=HUP 490-dns
```

## Google OAuth CIDR Ranges

These IP ranges must remain ACCEPT'd in `exam-nat.service` for sign-in to work. Verify periodically at https://www.gstatic.com/ipranges/goog.json

| Range | Notes |
|---|---|
| `142.250.0.0/15` | Google global |
| `172.217.0.0/16` | Google global |
| `74.125.0.0/16` | Google global |

## Troubleshooting

**DNS container won't start / port 53 conflict**
The Pi's host dnsmasq may already be listening on port 53. Stop it first:
```bash
sudo systemctl stop dnsmasq
sudo systemctl disable dnsmasq
```
Then rerun `start-exam.sh`.

**Students can't connect to the AP**
Check hostapd logs: `sudo journalctl -u hostapd-exam -f`
Verify wlan0 is not already in use: `iwconfig wlan0`

**Sign-in fails (OAuth error)**
1. Confirm `accounts.google.com` resolves: `nslookup accounts.google.com <wlan0-ip>`
2. Check FORWARD rules allow Google CIDRs: `sudo iptables -L FORWARD -n`
3. Verify `NEXTAUTH_URL` in `.env` matches the Pi's actual IP

**Verify DNS blocking is working**
From a device connected to the exam WiFi:
```bash
nslookup accounts.google.com   # should resolve (allowlisted)
nslookup example.com           # should return 0.0.0.0 (blocked)
```
