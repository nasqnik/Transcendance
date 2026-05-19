# this script is used to generate a self-signed TLS certificate for local HTTPS (dev only).

#!/usr/bin/env bash
# Run from anywhere: bash security/ssl/config.sh

# set -euo pipefail is a bash option that makes the script exit if any command fails or if any variable is unbound.
set -euo pipefail

# SCRIPT_DIR is the directory of the script.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Generate a self-signed TLS certificate for local HTTPS (dev only).
#
# Outputs (in this directory):
#   server.key  — private key (keep secret)
#   server.crt  — public certificate
#
# Valid 365 days. Browsers will warn until you trust this self-signed cert.
#
# openssl flags:
#   -x509              — output a certificate (not just a CSR)
#   -newkey rsa:4096   — create a new 4096-bit RSA key pair
#   -sha512            — sign with SHA-512
#   -days 365          — expire after one year
#   -nodes              — do not encrypt the key file with a passphrase
#   -keyout / -out      — where to write the key and certificate
#   -addext             — SAN: valid for localhost and 127.0.0.1
#   -subj "/CN=localhost" — certificate name shown to clients

openssl req -x509 -newkey rsa:4096 -sha512 -days 365 \
  -nodes \
  -keyout "$SCRIPT_DIR/server.key" \
  -out "$SCRIPT_DIR/server.crt" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Created: $SCRIPT_DIR/server.key and $SCRIPT_DIR/server.crt"

# sources <links>:
# https://stackoverflow.com/questions/10175812/how-can-i-generate-a-self-signed-ssl-certificate-using-openssl