#!/usr/bin/env python3
"""
Signs the automation_scripts.js bundle using the ECDSA P-256 private key.
Usage:
    python3 scripts/sign_scraper.py [path_to_js_file...]
"""

import os
import re
import sys
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_KEY_PATH = os.path.join(SCRIPT_DIR, "scraper_private_key.pem")

DEFAULT_FILES = [
    os.path.abspath(os.path.join(SCRIPT_DIR, "..", "app", "src", "main", "assets", "automation_scripts.js")),
    os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "scraper", "automation_scripts.js")),
    os.path.abspath(os.path.join(SCRIPT_DIR, "..", "scraper", "automation_scripts.js")),
]

def load_private_key(key_path):
    if not os.path.exists(key_path):
        print(f"Error: Private key not found at {key_path}")
        sys.exit(1)
    with open(key_path, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)

def get_canonical_content(raw_content: str) -> str:
    """
    Strips the // Signature: ... line and normalizes line endings to \n.
    """
    content = raw_content.replace("\r\n", "\n")
    # Remove any existing Signature line
    content = re.sub(r"^//\s*[Ss]ignature:.*?\n", "", content, flags=re.MULTILINE)
    return content

def sign_content(content: str, private_key) -> str:
    canonical = get_canonical_content(content)
    signature = private_key.sign(
        canonical.encode("utf-8"),
        ec.ECDSA(hashes.SHA256())
    )
    return base64.b64encode(signature).decode("utf-8")

def sign_file(filepath: str, private_key):
    if not os.path.exists(filepath):
        return False

    with open(filepath, "r", encoding="utf-8") as f:
        raw = f.read()

    canonical = get_canonical_content(raw)
    sig_b64 = sign_content(raw, private_key)

    # Insert signature line right after the opening comment block or at top
    sig_line = f"// Signature: {sig_b64}\n"
    if canonical.startswith("/**"):
        end_idx = canonical.find("*/\n")
        if end_idx != -1:
            signed_script = canonical[:end_idx + 3] + sig_line + canonical[end_idx + 3:]
        else:
            signed_script = sig_line + canonical
    else:
        signed_script = sig_line + canonical

    with open(filepath, "w", encoding="utf-8", newline="\n") as f:
        f.write(signed_script)

    print(f"✓ Signed: {filepath}")
    print(f"  Signature: {sig_b64[:30]}...")
    return True

def main():
    target_files = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_FILES
    priv_key = load_private_key(DEFAULT_KEY_PATH)

    signed_count = 0
    for path in target_files:
        if sign_file(path, priv_key):
            signed_count += 1

    if signed_count == 0:
        print("Warning: No target files found to sign.")
    else:
        print(f"Successfully signed {signed_count} file(s).")

if __name__ == "__main__":
    main()
