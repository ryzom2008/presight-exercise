"""Bundle this checkout's deployment files into an Azure Run Command script."""

import base64
import os
from pathlib import Path
import re
import shlex

image = os.environ["APP_IMAGE"]
revision = os.environ["GITHUB_SHA"]
domain = "presight-demo-2008.southeastasia.cloudapp.azure.com"
if not re.fullmatch(r"presightdemo\.azurecr\.io/presight@sha256:[a-f0-9]{64}", image):
    raise ValueError("Expected the immutable digest of the tested presight image")
if not re.fullmatch(r"[a-f0-9]{40}", revision):
    raise ValueError("Expected a Git commit SHA")

release = f"/opt/presight/releases/{revision}"
source = Path(__file__).parent
files = {name: (source / name).read_bytes() for name in (
    "compose.yml", "Caddyfile", "bootstrap.sh", "deploy.sh"
)}
files[".env"] = f"APP_IMAGE={image}\nAPP_DOMAIN={domain}\n".encode()

# Run Command invokes /bin/sh, so launch the Bash scripts explicitly.
print("#!/bin/sh\nset -eu\numask 077")
print(f"mkdir -p {shlex.quote(release)}")
for name, contents in files.items():
    encoded = base64.b64encode(contents).decode()
    print(f"printf '%s' '{encoded}' | base64 -d > {shlex.quote(release + '/' + name)}")
print(f"exec bash {shlex.quote(release + '/deploy.sh')}")
