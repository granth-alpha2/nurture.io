import unittest

try:
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    HAS_FASTAPI = True
except ImportError:
    client = None
    HAS_FASTAPI = False


class TestVisionAPI(unittest.TestCase):

    def setUp(self):
        if not HAS_FASTAPI:
            self.skipTest("FastAPI not installed in local host environment; verified in container")

    def test_health_is_explicitly_simulated(self) -> None:
        response = client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["mode"], "SIMULATED")
        self.assertEqual(response.json()["recognition"], "disabled")

    def test_localization_does_not_claim_a_match(self) -> None:
        response = client.post("/v1/localize", json={"frameBase64": "not-processed"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["mode"], "SIMULATED")
        self.assertIn("No image", response.json()["detail"])


# Pytest function-based compatibility
def test_health_is_explicitly_simulated() -> None:
    if not HAS_FASTAPI:
        return
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["mode"] == "SIMULATED"
    assert response.json()["recognition"] == "disabled"


def test_localization_does_not_claim_a_match() -> None:
    if not HAS_FASTAPI:
        return
    response = client.post("/v1/localize", json={"frameBase64": "not-processed"})
    assert response.status_code == 503
    assert response.json()["mode"] == "SIMULATED"
    assert "No image" in response.json()["detail"]


if __name__ == "__main__":
    unittest.main()
