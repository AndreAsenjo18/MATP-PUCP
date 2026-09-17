"""Domain errors. Messages are user-facing and therefore written in Spanish (ADR-002)."""


class DomainError(Exception):
    """Base class for business rule violations. `code` is stable and machine-readable."""

    code = "domain_error"

    def __init__(self, message: str, *, code: str | None = None, details: dict | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        self.details = details or {}


class ValidationFailed(DomainError):
    code = "validation_failed"


class NotFound(DomainError):
    code = "not_found"


class PermissionDenied(DomainError):
    code = "permission_denied"


class BusinessRuleViolation(DomainError):
    code = "business_rule_violation"


class ImmutableInventoryCode(BusinessRuleViolation):
    """RN-002: an assigned inventory code (I) cannot be edited or removed."""

    code = "immutable_inventory_code"


class PhysicalDeleteForbidden(BusinessRuleViolation):
    """RN-005: information is never physically deleted."""

    code = "physical_delete_forbidden"


class AppendOnlyViolation(BusinessRuleViolation):
    """Audit log, movements, assessments and source records cannot be modified."""

    code = "append_only_violation"


class MissingAuditContext(BusinessRuleViolation):
    """Every write must identify who performs it and its origin."""

    code = "missing_audit_context"
