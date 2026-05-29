from uuid import UUID

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from .actors import KidActor, ParentActor


class KidJWTAuthentication(JWTAuthentication):
    """Validate kid JWT locally — no auth-service DB lookup."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        if validated_token.get('role') != 'kid':
            return None

        kid_id = validated_token.get('kid_id')
        if not kid_id:
            raise InvalidToken('Kid token missing kid_id claim.')

        actor = KidActor(
            kid_id=UUID(str(kid_id)),
            username=str(validated_token.get('username', '')),
        )
        return (actor, validated_token)


class ParentJWTAuthentication(JWTAuthentication):
    """Validate parent JWT locally — no auth-service DB lookup."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        if validated_token.get('role') == 'kid':
            return None

        user_id = validated_token.get('user_id')
        if not user_id:
            raise InvalidToken('Parent token missing user_id claim.')

        raw_kid_ids = validated_token.get('kid_ids', [])
        kid_ids = tuple(UUID(str(k)) for k in raw_kid_ids)

        actor = ParentActor(
            user_id=UUID(str(user_id)),
            username=str(validated_token.get('username', '')),
            email=str(validated_token.get('email', '')),
            kid_ids=kid_ids,
        )
        return (actor, validated_token)
