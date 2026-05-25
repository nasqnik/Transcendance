from rest_framework_simplejwt.tokens import RefreshToken


class KidRefreshToken(RefreshToken):
    # It marks a method that belongs to the class, not to one object instance.
    # so we can call it like -> KidRefreshToken.for_kid(kid)
    # instead of -> kid.refresh_token.for_kid(kid)
    # we call it a constructor helper method
    @classmethod
    def for_kid(cls, kid):
        token = cls()
        token["role"] = "kid"
        token["kid_id"] = str(kid.id)
        token["username"] = kid.username
        return token

# cls is the class itself
# self is the instance of the class

# RefreshToken:
# SimpleJWT’s base class. It already knows how to:
# 1. create a token object
# 2. sign it with your secret
# 3. set expiry
# 4. build an access token from the refresh token

# You extend it instead of starting from scratch.