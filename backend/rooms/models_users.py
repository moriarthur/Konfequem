import uuid
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class Organization(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    invite_key = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"


class User(AbstractUser):
    ROLE_CHOICES = [
        ("platform_admin", "Platform Admin"),
        ("org_admin", "Organization Admin"),
        ("member", "Member"),
    ]

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="member",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="members",
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    def clean(self):
        super().clean()
        # Changing a user's organization would silently turn their existing
        # bookings cross-tenant (booking.organization no longer matches
        # user.organization). Forbidden while ANY booking references the
        # user — including cancelled and completed ones: they are history.
        # Matched by the rooms_user_org_guard DB trigger (migration 0007)
        # for writers that bypass validation.
        if not self.pk:
            return
        old_org_id = (
            User.objects.filter(pk=self.pk)
            .values_list("organization_id", flat=True)
            .first()
        )
        if old_org_id != self.organization_id and self.bookings.exists():
            raise ValidationError(
                {"organization": "User has bookings; cannot change organization."}
            )

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
