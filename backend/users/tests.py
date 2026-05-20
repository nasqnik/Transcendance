from unittest.mock import patch

from django.core import mail
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import CustomUser, GuardianInvitation, Kid


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://localhost",
)
class KidSignupTests(APITestCase):
    def test_kid_signup_creates_kid_and_pending_invitation(self):
        response = self.client.post(
            "/api/kids/signup/",
            {
                "name": "Alex",
                "username": "alex_kid",
                "password": "secure-pass-1",
                "parent_email": "Parent@Example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["registration_status"], "awaiting_primary_parent")
        self.assertEqual(response.data["message"], "Waiting for parent response")

        kid = Kid.objects.get(username="alex_kid")
        self.assertTrue(kid.check_password("secure-pass-1"))
        self.assertIsNone(kid.parent)

        invitation = GuardianInvitation.objects.get(kid=kid)
        self.assertEqual(invitation.invite_email, "parent@example.com")
        self.assertEqual(invitation.status, GuardianInvitation.Status.PENDING)
        self.assertEqual(invitation.role, GuardianInvitation.Role.PRIMARY)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("parent@example.com", mail.outbox[0].to)
        self.assertIn(str(invitation.token), mail.outbox[0].body)


class ParentRegisterTests(APITestCase):
    def test_parent_register_creates_user(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "parent@example.com",
                "username": "parent_one",
                "password": "secure-pass-1",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = CustomUser.objects.get(email="parent@example.com")
        self.assertEqual(user.role, "parent")
        self.assertTrue(user.check_password("secure-pass-1"))


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://localhost",
)
class AcceptGuardianInviteTests(APITestCase):
    def setUp(self):
        signup = self.client.post(
            "/api/kids/signup/",
            {
                "name": "Alex",
                "username": "alex_accept",
                "password": "secure-pass-1",
                "parent_email": "parent@example.com",
            },
            format="json",
        )
        self.invite_token = GuardianInvitation.objects.get(
            kid_id=signup.data["kid_id"]
        ).token

    def test_invite_detail_is_public(self):
        response = self.client.get(f"/api/guardian-invitations/{self.invite_token}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["kid_name"], "Alex")
        self.assertEqual(response.data["invite_email"], "parent@example.com")

    def test_accept_invite_activates_kid(self):
        self.client.post(
            "/api/auth/register/",
            {
                "email": "parent@example.com",
                "username": "parent_one",
                "password": "secure-pass-1",
            },
            format="json",
        )
        login = self.client.post(
            "/api/auth/token/",
            {"email": "parent@example.com", "password": "secure-pass-1"},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login.data['access']}"
        )

        response = self.client.post(
            "/api/guardian-invitations/accept/",
            {"token": str(self.invite_token)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["registration_status"], "active")

        kid = Kid.objects.get(username="alex_accept")
        parent = CustomUser.objects.get(email="parent@example.com")
        self.assertEqual(kid.parent_id, parent.id)
        self.assertEqual(kid.registration_status, Kid.RegistrationStatus.ACTIVE)

        invitation = GuardianInvitation.objects.get(token=self.invite_token)
        self.assertEqual(invitation.status, GuardianInvitation.Status.ACCEPTED)
        self.assertEqual(invitation.parent_id, parent.id)

    def test_accept_rejects_wrong_parent_email(self):
        self.client.post(
            "/api/auth/register/",
            {
                "email": "other@example.com",
                "username": "other_parent",
                "password": "secure-pass-1",
            },
            format="json",
        )
        login = self.client.post(
            "/api/auth/token/",
            {"email": "other@example.com", "password": "secure-pass-1"},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login.data['access']}"
        )

        response = self.client.post(
            "/api/guardian-invitations/accept/",
            {"token": str(self.invite_token)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        kid = Kid.objects.get(username="alex_accept")
        self.assertEqual(
            kid.registration_status,
            Kid.RegistrationStatus.AWAITING_PRIMARY_PARENT,
        )


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://localhost",
    MAX_GUARDIANS_PER_KID=2,
)
class KidAuthAndSecondParentInviteTests(APITestCase):
    def _signup_and_accept_primary(self):
        signup = self.client.post(
            "/api/kids/signup/",
            {
                "name": "Alex",
                "username": "alex_kid2",
                "password": "secure-pass-1",
                "parent_email": "parent@example.com",
            },
            format="json",
        )
        token = GuardianInvitation.objects.get(kid_id=signup.data["kid_id"]).token
        self.client.post(
            "/api/auth/register/",
            {
                "email": "parent@example.com",
                "username": "parent_one",
                "password": "secure-pass-1",
            },
            format="json",
        )
        login = self.client.post(
            "/api/auth/token/",
            {"email": "parent@example.com", "password": "secure-pass-1"},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login.data['access']}"
        )
        self.client.post(
            "/api/guardian-invitations/accept/",
            {"token": str(token)},
            format="json",
        )
        self.client.credentials()
        return signup.data["kid_id"]

    def test_kid_login_after_primary_accepted(self):
        self._signup_and_accept_primary()
        response = self.client.post(
            "/api/auth/kid/token/",
            {"username": "alex_kid2", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_kid_cannot_login_before_active(self):
        self.client.post(
            "/api/kids/signup/",
            {
                "name": "Sam",
                "username": "sam_kid",
                "password": "secure-pass-1",
                "parent_email": "parent@example.com",
            },
            format="json",
        )
        response = self.client.post(
            "/api/auth/kid/token/",
            {"username": "sam_kid", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_active_kid_invites_second_parent(self):
        self._signup_and_accept_primary()
        kid_login = self.client.post(
            "/api/auth/kid/token/",
            {"username": "alex_kid2", "password": "secure-pass-1"},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {kid_login.data['access']}"
        )
        response = self.client.post(
            "/api/kids/invite-parent/",
            {
                "parent_email": "second@example.com",
                "invited_username_hint": "second_parent",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["role"], "secondary")
        self.assertEqual(len(mail.outbox), 2)


class GoogleLoginTests(APITestCase):
    @patch("users.serializers.verify_google_id_token")
    def test_google_login_creates_parent_and_returns_jwt(self, mock_verify):
        mock_verify.return_value = {
            "sub": "google-sub-123",
            "email": "google.parent@example.com",
            "email_verified": True,
            "iss": "accounts.google.com",
        }

        response = self.client.post(
            "/api/auth/google/",
            {"id_token": "fake-google-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        user = CustomUser.objects.get(email="google.parent@example.com")
        self.assertEqual(user.google_sub, "google-sub-123")
        self.assertEqual(user.role, "parent")

    @patch("users.serializers.verify_google_id_token")
    def test_google_login_links_existing_email_user(self, mock_verify):
        CustomUser.objects.create_user(
            email="existing@example.com",
            username="existing",
            password="secure-pass-1",
            role="parent",
        )
        mock_verify.return_value = {
            "sub": "google-sub-456",
            "email": "existing@example.com",
            "email_verified": True,
            "iss": "accounts.google.com",
        }

        response = self.client.post(
            "/api/auth/google/",
            {"id_token": "fake-google-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = CustomUser.objects.get(email="existing@example.com")
        self.assertEqual(user.google_sub, "google-sub-456")
