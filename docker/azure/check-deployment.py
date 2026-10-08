"""Check guest-script completion in either Azure Run Command response format."""

import json
import sys

MARKER = "PRESIGHT_DEPLOY_SUCCEEDED"


def deployment_succeeded(result):
    statuses = result.get("value", [])
    if any(
        item.get("level", "").lower() == "error"
        or item.get("code", "").lower().endswith("/failed")
        for item in statuses
    ):
        return False

    for item in statuses:
        code = item.get("code")
        output = item.get("message", "")
        if code == "ProvisioningState/succeeded":
            # Some agents combine both streams into one provisioning status.
            if "[stdout]\n" not in output:
                continue
            output = output.split("[stdout]\n", 1)[1].split("\n[stderr]", 1)[0]
        elif code != "ComponentStatus/StdOut/succeeded":
            continue

        # Older deploy.sh versions printed the marker immediately after JSON.
        if output.rstrip().endswith(MARKER):
            return True
    return False


if __name__ == "__main__":
    with open(sys.argv[1]) as response:
        result = json.load(response)
    if not deployment_succeeded(result):
        raise SystemExit("VM deployment failed; inspect Run Command output above.")
