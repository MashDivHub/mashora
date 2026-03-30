PLANS = {
    "free": {
        "name": "Free",
        "price_cents": 0,
        "max_users": 5,
        "max_apps": 1,
        "features": {"support": "community"},
    },
    "starter": {
        "name": "Starter",
        "price_cents": 2900,
        "max_users": 15,
        "max_apps": 5,
        "features": {"support": "email", "custom_domain": True},
    },
    "professional": {
        "name": "Professional",
        "price_cents": 7900,
        "max_users": 50,
        "max_apps": 20,
        "features": {"support": "priority", "custom_domain": True, "api_access": True},
    },
    "enterprise": {
        "name": "Enterprise",
        "price_cents": 19900,
        "max_users": -1,
        "max_apps": -1,
        "features": {
            "support": "dedicated",
            "custom_domain": True,
            "api_access": True,
            "sla": True,
        },
    },
}


def get_plan(plan_name: str) -> dict | None:
    """Return plan config dict or None if plan does not exist."""
    return PLANS.get(plan_name)


def get_plan_limits(plan_name: str) -> tuple[int, int]:
    """Return (max_users, max_apps) for the given plan. -1 means unlimited."""
    plan = PLANS.get(plan_name)
    if plan is None:
        return (0, 0)
    return (plan["max_users"], plan["max_apps"])
