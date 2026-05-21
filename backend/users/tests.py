from unittest.mock import patch

from django.core import mail
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import CustomUser, GuardianInvitation, Kid


def _verify_parent(client, email):
    user = CustomUser.objects.get(email=email)
    response = client.post(
        "/api/auth/verify-email/",
        {"token": str(user.email_verification_token)},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    user.refresh_from_db()
    return user


def _verify_kid(client, username):
    kid = Kid.objects.get(username=username)
    response = client.post(
        "/api/auth/kid/verify-email/",
        {"token": str(kid.email_verification_token)},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    kid.refresh_from_db()
    return kid


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
                "email": "alex@example.com",
                "password": "secure-pass-1",
                "parent_email": "Parent@Example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["registration_status"], "awaiting_primary_parent")
        self.assertFalse(response.data["email_verified"])

        kid = Kid.objects.get(username="alex_kid")
        self.assertEqual(kid.email, "alex@example.com")
        self.assertFalse(kid.email_verified)
        self.assertTrue(kid.check_password("secure-pass-1"))
        self.assertIsNone(kid.parent)

        invitation = GuardianInvitation.objects.get(kid=kid)
        self.assertEqual(invitation.invite_email, "parent@example.com")
        self.assertEqual(len(mail.outbox), 2)
        self.assertIn(str(invitation.token), mail.outbox[0].body)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://localhost",
)
class ParentRegisterTests(APITestCase):
    def test_parent_register_sends_verification_and_blocks_login(self):
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
        self.assertIn("Check your email", response.data["message"])
        self.assertEqual(len(mail.outbox), 1)

        user = CustomUser.objects.get(email="parent@example.com")
        self.assertFalse(user.email_verified)

        login = self.client.post(
            "/api/auth/token/",
            {"email": "parent@example.com", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_401_UNAUTHORIZED)

        _verify_parent(self.client, "parent@example.com")
        login = self.client.post(
            "/api/auth/token/",
            {"email": "parent@example.com", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)


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
                "email": "alex@example.com",
                "password": "secure-pass-1",
                "parent_email": "parent@example.com",
            },
            format="json",
        )
        _verify_kid(self.client, "alex_accept")
        self.invite_token = GuardianInvitation.objects.get(
            kid_id=signup.data["kid_id"]
        ).token

    def test_invite_detail_is_public(self):
        response = self.client.get(f"/api/guardian-invitations/{self.invite_token}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["kid_name"], "Alex")

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
        _verify_parent(self.client, "parent@example.com")
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
        _verify_parent(self.client, "other@example.com")
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
                "email": "alex2@example.com",
                "password": "secure-pass-1",
                "parent_email": "parent@example.com",
            },
            format="json",
        )
        _verify_kid(self.client, "alex_kid2")
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
        _verify_parent(self.client, "parent@example.com")
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

    def test_kid_cannot_login_before_email_verified(self):
        self.client.post(
            "/api/kids/signup/",
            {
                "name": "Sam",
                "username": "sam_kid",
                "email": "sam@example.com",
                "password": "secure-pass-1",
                "parent_email": "parent@example.com",
            },
            format="json",
        )
        Kid.objects.filter(username="sam_kid").update(
            registration_status=Kid.RegistrationStatus.ACTIVE
        )
        response = self.client.post(
            "/api/auth/kid/token/",
            {"username": "sam_kid", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_kid_cannot_login_before_active(self):
        self.client.post(
            "/api/kids/signup/",
            {
                "name": "Sam",
                "username": "sam_kid2",
                "email": "sam2@example.com",
                "password": "secure-pass-1",
                "parent_email": "parent@example.com",
            },
            format="json",
        )
        _verify_kid(self.client, "sam_kid2")
        response = self.client.post(
            "/api/auth/kid/token/",
            {"username": "sam_kid2", "password": "secure-pass-1"},
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
        user = CustomUser.objects.get(email="google.parent@example.com")
        self.assertTrue(user.email_verified)

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
        self.assertTrue(user.email_verified)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://localhost",
)
class KidGoogleAuthTests(APITestCase):
    @patch("users.serializers.verify_google_id_token")
    def test_kid_google_signup_creates_account_and_invites_parent(self, mock_verify):
        mock_verify.return_value = {
            "sub": "kid-google-sub-1",
            "email": "kid.google@example.com",
            "email_verified": True,
            "iss": "accounts.google.com",
        }

        response = self.client.post(
            "/api/kids/signup/google/",
            {
                "id_token": "fake-token",
                "name": "Google Kid",
                "username": "google_kid",
                "parent_email": "parent@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        kid = Kid.objects.get(username="google_kid")
        self.assertTrue(kid.email_verified)
        self.assertEqual(kid.google_sub, "kid-google-sub-1")
        self.assertEqual(len(mail.outbox), 1)

    @patch("users.serializers.verify_google_id_token")
    def test_kid_google_login_after_parent_accepts(self, mock_verify):
        mock_verify.return_value = {
            "sub": "kid-google-sub-2",
            "email": "kid2.google@example.com",
            "email_verified": True,
            "iss": "accounts.google.com",
        }
        self.client.post(
            "/api/kids/signup/google/",
            {
                "id_token": "fake-token",
                "name": "Google Kid",
                "username": "google_kid2",
                "parent_email": "parent@example.com",
            },
            format="json",
        )
        kid = Kid.objects.get(username="google_kid2")
        kid.registration_status = Kid.RegistrationStatus.ACTIVE
        kid.save(update_fields=["registration_status"])

        response = self.client.post(
            "/api/auth/kid/google/",
            {"id_token": "fake-token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
