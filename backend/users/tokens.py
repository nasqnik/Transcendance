from rest_framework_simplejwt.tokens import RefreshToken


class KidRefreshToken(RefreshToken):
    @classmethod
    def for_kid(cls, kid):
        token = cls()
        token["role"] = "kid"
        token["kid_id"] = str(kid.id)
        token["username"] = kid.username
        return token
