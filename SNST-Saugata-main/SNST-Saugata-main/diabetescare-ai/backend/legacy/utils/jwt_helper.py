from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt


def make_tokens(user_id: str, user_type: str, extra_claims: dict | None = None):
    claims = {"user_type": user_type}
    if extra_claims:
        claims.update(extra_claims)
    access = create_access_token(identity=user_id, additional_claims=claims)
    refresh = create_refresh_token(identity=user_id, additional_claims=claims)
    return access, refresh


def make_token(user_id: str, user_type: str, extra_claims: dict | None = None):
    """Single access token (legacy callers)."""
    access, _ = make_tokens(user_id, user_type, extra_claims)
    return access


def claims_user_type() -> str | None:
    token = get_jwt()
    return token.get("user_type")
