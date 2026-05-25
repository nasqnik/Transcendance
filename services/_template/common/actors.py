from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class KidActor:
    kid_id: UUID
    username: str

    @property
    def pk(self):
        return self.kid_id

    @property
    def is_authenticated(self):
        return True


@dataclass(frozen=True)
class ParentActor:
    user_id: UUID
    username: str
    email: str

    @property
    def pk(self):
        return self.user_id

    @property
    def is_authenticated(self):
        return True
