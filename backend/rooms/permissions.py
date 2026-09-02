from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsOrgAdminOrReadOnly(BasePermission):
    """Reads: any authenticated user. Writes: org admins only.

    Staff/platform admins keep read-all access (see RoomViewSet.get_queryset)
    but never get API write access — they manage rooms via Django admin.
    A user who is both staff and org_admin is denied by design; the product
    model has no such hybrid.
    """

    message = "Only organization admins can manage rooms."

    def has_permission(self, request, view):
        user = request.user
        if request.method in SAFE_METHODS:
            return bool(user and user.is_authenticated)
        return (
            bool(user and user.is_authenticated)
            and not user.is_staff
            and user.role == "org_admin"
            and user.organization_id is not None
        )
