"""Pagination primitives shared by list endpoints (design D6)."""

from typing import Annotated, Any

from fastapi import Query
from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20


class Page[T](BaseModel):
    items: list[T]
    total: int = Field(ge=0, description="Total de resultados que cumplen los filtros.")
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=MAX_PAGE_SIZE)


class PageParams(BaseModel):
    page: int = 1
    page_size: int = DEFAULT_PAGE_SIZE

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: Annotated[int, Query(ge=1, description="Número de página (desde 1).")] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="Resultados por página (máx. 100).")
    ] = DEFAULT_PAGE_SIZE,
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


def paginate(session: Session, statement: Select[Any], params: PageParams) -> tuple[list[Any], int]:
    """Run a select returning ORM entities with limit/offset and its total count."""
    total = session.scalar(select(func.count()).select_from(statement.order_by(None).subquery()))
    rows = list(session.scalars(statement.limit(params.page_size).offset(params.offset)))
    return rows, total or 0
