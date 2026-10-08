import runpy
from pathlib import Path
import unittest

check = runpy.run_path(str(Path(__file__).with_name("check-deployment.py")))[
    "deployment_succeeded"
]
marker = "PRESIGHT_DEPLOY_SUCCEEDED"


class DeploymentOutputTests(unittest.TestCase):
    def test_combined_output_with_health_json_and_tls_retries(self):
        # Reproduces the VM agent's response in the failed GitHub run.
        for separator in ("", "\n"):
            with self.subTest(separator=separator):
                self.assertTrue(check({"value": [{
                    "code": "ProvisioningState/succeeded",
                    "level": "Info",
                    "message": 'Enable succeeded: \n[stdout]\nLogin Succeeded\n'
                    + '{"status":"ok"}' + separator + marker
                    + '\n\n[stderr]\ncurl: (35) TLS retry\n',
                }]}))

    def test_separate_streams(self):
        self.assertTrue(check({"value": [
            {"code": "ComponentStatus/StdOut/succeeded", "message": marker + "\n"},
            {"code": "ComponentStatus/StdErr/succeeded", "message": "TLS retry"},
        ]}))

    def test_provisioning_success_alone_or_stderr_marker_is_not_success(self):
        for message in ("Enable succeeded", "[stdout]\n\n[stderr]\n" + marker):
            with self.subTest(message=message):
                self.assertFalse(check({"value": [{
                    "code": "ProvisioningState/succeeded", "message": message,
                }]}))
        self.assertFalse(check({"value": [
            {"code": "ComponentStatus/StdErr/succeeded", "message": marker},
        ]}))
        self.assertFalse(check({"value": []}))

    def test_explicit_failure_overrides_marker(self):
        self.assertFalse(check({"value": [
            {"code": "ComponentStatus/StdOut/succeeded", "message": marker},
            {"code": "ProvisioningState/failed", "level": "Error"},
        ]}))


if __name__ == "__main__":
    unittest.main()
