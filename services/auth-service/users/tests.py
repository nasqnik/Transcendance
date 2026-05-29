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

    def test_kid_signup_rejects_parent_email(self):
        CustomUser.objects.create_user(
            email="parent@example.com",
            username="parent_one",
            password="secure-pass-1",
            role="parent",
        )

        response = self.client.post(
            "/api/kids/signup/",
            {
                "name": "Alex",
                "username": "alex_kid",
                "email": "parent@example.com",
                "password": "secure-pass-1",
                "parent_email": "other@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Kid.objects.filter(username="alex_kid").exists())

    def test_kid_signup_rejects_parent_username(self):
        CustomUser.objects.create_user(
            email="parent@example.com",
            username="shared_user",
            password="secure-pass-1",
            role="parent",
        )

        response = self.client.post(
            "/api/kids/signup/",
            {
                "name": "Alex",
                "username": "shared_user",
                "email": "alex@example.com",
                "password": "secure-pass-1",
                "parent_email": "other@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Kid.objects.filter(email="alex@example.com").exists())

    def test_kid_signup_rejects_same_email_as_parent_email(self):
        response = self.client.post(
            "/api/kids/signup/",
            {
                "name": "Alex",
                "username": "alex_same_email",
                "email": "shared@example.com",
                "password": "secure-pass-1",
                "parent_email": "shared@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Kid.objects.filter(username="alex_same_email").exists())

    def test_kid_signup_rejects_parent_email_that_is_kid_account(self):
        Kid.objects.create(
            name="Other Kid",
            username="other_kid",
            email="kid.parent@example.com",
            email_verified=True,
            registration_status=Kid.RegistrationStatus.ACTIVE,
        )

        response = self.client.post(
            "/api/kids/signup/",
            {
                "name": "Alex",
                "username": "alex_kid3",
                "email": "alex3@example.com",
                "password": "secure-pass-1",
                "parent_email": "kid.parent@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Kid.objects.filter(username="alex_kid3").exists())

    def test_kids_can_share_display_name(self):
        self.client.post(
            "/api/kids/signup/",
            {
                "name": "Alex",
                "username": "alex_one",
                "email": "alex1@example.com",
                "password": "secure-pass-1",
                "parent_email": "parent1@example.com",
            },
            format="json",
        )
        response = self.client.post(
            "/api/kids/signup/",
            {
                "name": "Alex",
                "username": "alex_two",
                "email": "alex2@example.com",
                "password": "secure-pass-1",
                "parent_email": "parent2@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Kid.objects.filter(name="Alex").count(), 2)


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
            {"emailOrUsername": "parent@example.com", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            login.data["detail"],
            "Please verify your email before logging in.",
        )

        login_with_username = self.client.post(
            "/api/auth/token/",
            {"emailOrUsername": "parent_one", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(login_with_username.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            login_with_username.data["detail"],
            "Please verify your email before logging in.",
        )

        _verify_parent(self.client, "parent@example.com")
        login = self.client.post(
            "/api/auth/token/",
            {"emailOrUsername": "parent@example.com", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_parent_register_rejects_kid_email(self):
        Kid.objects.create(
            name="Alex",
            username="alex_kid",
            email="kid@example.com",
            email_verified=True,
            registration_status=Kid.RegistrationStatus.AWAITING_PRIMARY_PARENT,
        )

        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "kid@example.com",
                "username": "parent_one",
                "password": "secure-pass-1",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CustomUser.objects.filter(email="kid@example.com").count(), 0)

    def test_parent_register_rejects_kid_username(self):
        Kid.objects.create(
            name="Alex",
            username="kid_user",
            email="kid@example.com",
            email_verified=True,
            registration_status=Kid.RegistrationStatus.AWAITING_PRIMARY_PARENT,
        )

        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "parent@example.com",
                "username": "kid_user",
                "password": "secure-pass-1",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(CustomUser.objects.filter(email="parent@example.com").exists())


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
            {"emailOrUsername": "parent@example.com", "password": "secure-pass-1"},
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
            {"emailOrUsername": "other@example.com", "password": "secure-pass-1"},
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
            {"emailOrUsername": "parent@example.com", "password": "secure-pass-1"},
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
            {"emailOrUsername": "alex_kid2", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response_with_email = self.client.post(
            "/api/auth/kid/token/",
            {"emailOrUsername": "alex2@example.com", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(response_with_email.status_code, status.HTTP_200_OK)

    def test_kid_token_verify(self):
        self._signup_and_accept_primary()
        login = self.client.post(
            "/api/auth/kid/token/",
            {"emailOrUsername": "alex_kid2", "password": "secure-pass-1"},
            format="json",
        )
        verify = self.client.post(
            "/api/auth/kid/token/verify/",
            {"token": login.data["access"]},
            format="json",
        )
        self.assertEqual(verify.status_code, status.HTTP_200_OK)

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
            {"emailOrUsername": "sam_kid", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response_with_email = self.client.post(
            "/api/auth/kid/token/",
            {"emailOrUsername": "sam@example.com", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(response_with_email.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            response_with_email.data["detail"],
            "Verify your email first.",
        )

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
            {"emailOrUsername": "sam_kid2", "password": "secure-pass-1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_active_kid_invites_second_parent(self):
        self._signup_and_accept_primary()
        kid_login = self.client.post(
            "/api/auth/kid/token/",
            {"emailOrUsername": "alex_kid2", "password": "secure-pass-1"},
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

    @patch("users.serializers.verify_google_id_token")
    def test_google_login_rejects_kid_google_sub(self, mock_verify):
        Kid.objects.create(
            name="Google Kid",
            username="google_kid",
            email="kid.google@example.com",
            google_sub="kid-google-sub-shared",
            email_verified=True,
            registration_status=Kid.RegistrationStatus.ACTIVE,
        )
        mock_verify.return_value = {
            "sub": "kid-google-sub-shared",
            "email": "kid.google@example.com",
            "email_verified": True,
            "iss": "accounts.google.com",
        }

        response = self.client.post(
            "/api/auth/google/",
            {"id_token": "fake-google-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(CustomUser.objects.filter(email="kid.google@example.com").exists())

    @patch("users.serializers.verify_google_id_token")
    def test_google_login_rejects_kid_email_without_google_sub(self, mock_verify):
        Kid.objects.create(
            name="Email Kid",
            username="email_kid",
            email="kid.only@example.com",
            email_verified=True,
            registration_status=Kid.RegistrationStatus.ACTIVE,
        )
        mock_verify.return_value = {
            "sub": "new-google-sub",
            "email": "kid.only@example.com",
            "email_verified": True,
            "iss": "accounts.google.com",
        }

        response = self.client.post(
            "/api/auth/google/",
            {"id_token": "fake-google-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(CustomUser.objects.filter(email="kid.only@example.com").exists())


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
    def test_kid_google_signup_rejects_parent_email(self, mock_verify):
        CustomUser.objects.create_user(
            email="parent@example.com",
            username="parent_one",
            password="secure-pass-1",
            role="parent",
        )
        mock_verify.return_value = {
            "sub": "kid-google-sub-parent-conflict",
            "email": "parent@example.com",
            "email_verified": True,
            "iss": "accounts.google.com",
        }

        response = self.client.post(
            "/api/kids/signup/google/",
            {
                "id_token": "fake-token",
                "name": "Google Kid",
                "username": "google_kid_conflict",
                "parent_email": "other@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Kid.objects.filter(username="google_kid_conflict").exists())

    @patch("users.serializers.verify_google_id_token")
    def test_kid_google_signup_rejects_parent_username(self, mock_verify):
        CustomUser.objects.create_user(
            email="parent@example.com",
            username="shared_google_user",
            password="secure-pass-1",
            role="parent",
        )
        mock_verify.return_value = {
            "sub": "kid-google-sub-username-conflict",
            "email": "kid.google@example.com",
            "email_verified": True,
            "iss": "accounts.google.com",
        }

        response = self.client.post(
            "/api/kids/signup/google/",
            {
                "id_token": "fake-token",
                "name": "Google Kid",
                "username": "shared_google_user",
                "parent_email": "other@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Kid.objects.filter(username="shared_google_user").exists())

    @patch("users.serializers.verify_google_id_token")
    def test_google_parent_signup_avoids_kid_username_collision(self, mock_verify):
        Kid.objects.create(
            name="Alex",
            username="john",
            email="kid@example.com",
            email_verified=True,
            registration_status=Kid.RegistrationStatus.ACTIVE,
        )
        mock_verify.return_value = {
            "sub": "parent-google-sub-john",
            "email": "john@example.com",
            "email_verified": True,
            "iss": "accounts.google.com",
        }

        response = self.client.post(
            "/api/auth/google/",
            {"id_token": "fake-google-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = CustomUser.objects.get(email="john@example.com")
        self.assertNotEqual(user.username, "john")

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
