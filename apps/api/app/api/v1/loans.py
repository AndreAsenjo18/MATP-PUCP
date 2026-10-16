"""Loan and exhibition contract stubs (prestamos-y-exposiciones; RF-018)."""

import uuid

from fastapi import APIRouter, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import CurrentUserDep
from app.api.errors import COMMON_ERROR_RESPONSES
from app.api.stubs import not_implemented, stub

CHANGE_LOANS = "prestamos-y-exposiciones"

router = APIRouter(responses=COMMON_ERROR_RESPONSES, tags=["Préstamos y exposiciones"])


class LoanStubOut(BaseModel):
    """Non-binding response until K1 defines the final request schemas."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000040",
                    "status": "PENDIENTE_DEFINICION",
                }
            ]
        }
    )

    id: uuid.UUID
    status: str = Field(description="Estado configurable; sus valores se acuerdan en K1.")


@router.get(
    "/loans",
    response_model=list[LoanStubOut],
    summary="Listar préstamos y exposiciones temporales",
    **stub(CHANGE_LOANS),
)
def list_loans(user: CurrentUserDep) -> list[LoanStubOut]:
    raise not_implemented(
        CHANGE_LOANS,
        [{"id": "01920000-0000-7000-8000-000000000040", "status": "PENDIENTE_DEFINICION"}],
    )


@router.post(
    "/loans",
    response_model=LoanStubOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un préstamo o salida de exhibición",
    **stub(CHANGE_LOANS),
)
def create_loan(user: CurrentUserDep) -> LoanStubOut:
    raise not_implemented(CHANGE_LOANS, LoanStubOut)


@router.put(
    "/loans/{loan_id}/status",
    response_model=LoanStubOut,
    summary="Actualizar el estado de un préstamo",
    **stub(CHANGE_LOANS),
)
def update_loan_status(loan_id: uuid.UUID, user: CurrentUserDep) -> LoanStubOut:
    raise not_implemented(CHANGE_LOANS, LoanStubOut)
