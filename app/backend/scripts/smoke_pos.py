"""Smoke-test the POS endpoints against a locally-running backend."""

import asyncio
import httpx


async def smoke() -> None:
    base = "http://localhost:8002"
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            try:
                r = await c.post(
                    f"{base}/api/v1/auth/login",
                    json={"login": "admin", "password": "admin"},
                )
            except httpx.ConnectError as e:
                print(f"Backend not reachable at {base}: {e}")
                return
            if r.status_code != 200:
                print(f"Login failed: {r.status_code} {r.text[:200]}")
                return
            token = r.json().get("access_token")
            h = {"Authorization": f"Bearer {token}"}
            print(f"Login OK, token acquired.")
            for path in (
                "/api/v1/pos/configs",
                "/api/v1/pos/payment-methods",
                "/api/v1/pos/categories",
                "/api/v1/pos/dashboard",
                "/api/v1/pos/sessions",
            ):
                try:
                    r = await c.get(f"{base}{path}", headers=h)
                except httpx.ConnectError as e:
                    print(f"{path}: connection error {e}")
                    continue
                extra = ""
                if r.status_code == 200:
                    try:
                        body = r.json()
                    except Exception:
                        body = None
                    if isinstance(body, dict) and "records" in body:
                        extra = f"  records={len(body['records'])}"
                    elif isinstance(body, list):
                        extra = f"  items={len(body)}"
                    elif isinstance(body, dict):
                        extra = f"  keys={list(body.keys())[:6]}"
                else:
                    extra = f"  body={r.text[:160]}"
                print(f"{path}: {r.status_code}{extra}")
    except Exception as e:
        print(f"Unexpected error: {type(e).__name__}: {e}")


if __name__ == "__main__":
    asyncio.run(smoke())
