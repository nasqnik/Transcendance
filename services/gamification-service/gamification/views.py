from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from common.permissions import IsInternalService, IsKid, IsParent
from .models import KidStat, KidProfile
from .serializers import (
    CompletionIngestSerializer,
    KidStatSerializer,
    KidProfileSerializer,
)
from .engine import apply_completion


@extend_schema(
    summary='Ingest a confirmed completion (internal)',
    description=(
        'Service-to-service endpoint called by task-service when a completion '
        'is confirmed. Authenticated by the X-Internal-Token shared secret, '
        'not a user JWT. Idempotent on completion_id.'
    ),
    request=CompletionIngestSerializer,
    parameters=[
        OpenApiParameter(
            name='X-Internal-Token',
            type=str,
            location=OpenApiParameter.HEADER,
            required=True,
            description='Shared internal-service secret.',
        ),
    ],
    responses={204: None},
    auth=[],
)
class InternalCompletionView(APIView):
    authentication_classes = []          # no JWT for internal calls
    permission_classes = [IsInternalService]

    def post(self, request):
        serializer = CompletionIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        apply_completion(
            kid_id=data['kid_id'],
            completion_id=data['completion_id'],
            category_points=data['category_points'],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    summary="List the kid's own stats",
    responses=KidStatSerializer(many=True),
)
class KidStatListView(APIView):
    permission_classes = [IsKid]

    def get(self, request):
        stats = KidStat.objects.filter(kid_id=request.user.kid_id)
        return Response(KidStatSerializer(stats, many=True).data)


@extend_schema(
    summary="Get the kid's profile (level, xp, coins)",
    responses=KidProfileSerializer,
)
class KidProfileView(APIView):
    permission_classes = [IsKid]

    def get(self, request):
        profile, _ = KidProfile.objects.get_or_create(kid_id=request.user.kid_id)
        return Response(KidProfileSerializer(profile).data)


@extend_schema(
    summary="List a guarded kid's stats (parent)",
    responses=KidStatSerializer(many=True),
)
class KidStatListViewParent(APIView):
    permission_classes = [IsParent]

    def get(self, request, kid_id):
        if kid_id not in request.user.kid_ids:
            return Response(status=status.HTTP_403_FORBIDDEN)
        stats = KidStat.objects.filter(kid_id=kid_id)
        return Response(KidStatSerializer(stats, many=True).data)