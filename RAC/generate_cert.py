"""
Generate a self-signed certificate for the remote desktop server.

Usage:
    python generate_cert.py <public-ip-or-hostname> [more names/IPs ...]

Example:
    python generate_cert.py 203.0.113.5 192.168.1.100 myhome.example.com

localhost and 127.0.0.1 are always included. Every address you will type
into the client's "IP" box must be listed here, or the browser will
reject the certificate.
"""

import ipaddress
import os
import sys
from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

extra_names = sys.argv[1:]

if not extra_names:
    print(__doc__)
    sys.exit("Give at least one IP or hostname (your public IP / LAN IP).")

# Generate private key
key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048
)

name = x509.Name([
    x509.NameAttribute(NameOID.COMMON_NAME, "localhost")
])

sans = [
    x509.DNSName("localhost"),
    x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
]

for entry in extra_names:
    try:
        sans.append(x509.IPAddress(ipaddress.ip_address(entry)))
    except ValueError:
        sans.append(x509.DNSName(entry))

now = datetime.now(timezone.utc)

cert = (
    x509.CertificateBuilder()
    .subject_name(name)
    .issuer_name(name)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now - timedelta(minutes=5))
    .not_valid_after(now + timedelta(days=365))
    .add_extension(
        x509.SubjectAlternativeName(sans),
        critical=False
    )
    .add_extension(
        x509.BasicConstraints(ca=False, path_length=None),
        critical=True
    )
    .add_extension(
        x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),
        critical=False
    )
    .sign(key, hashes.SHA256())
)

# Save private key (owner-only permissions where supported)
with open("server.key", "wb") as f:
    f.write(key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    ))

try:
    os.chmod("server.key", 0o600)
except OSError:
    pass

# Save certificate
with open("server.crt", "wb") as f:
    f.write(cert.public_bytes(serialization.Encoding.PEM))

print("Generated server.crt and server.key for:")
for san in sans:
    print("  -", san.value)