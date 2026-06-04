from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from .models import Kid


class KidJWTAuthentication(JWTAuthentication):
    """Authenticate kid access tokens (role=kid) without loading CustomUser."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        # we check here : 
            # 1. token format is valid
            # 2. Signature matches the secret key
            # 3. Token is not expired
        validated_token = self.get_validated_token(raw_token)
        if validated_token.get("role") != "kid":
            return None

        kid_id = validated_token.get("kid_id")
        if not kid_id:
            raise InvalidToken("Kid token missing kid_id claim.")

        try:
            kid = Kid.objects.get(pk=kid_id)
        except Kid.DoesNotExist as exc:
            raise InvalidToken("Kid not found.") from exc

        return (kid, validated_token)

# KidJWTAuthentication is a class that authenticates kid access tokens (role=kid) without loading CustomUser.
# the class inherits from JWTAuthentication and overrides the authenticate method to authenticate kid access tokens.

# jwt:
# header: Authorization: Bearer <token>