"""Rutas de administración: `Authorization: Bearer <ADMIN_TOKEN>` (variable de entorno).

Las usan la revisión de altas de puestos (#172) y la carga manual de eventos (#160).
"""

import os
import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException


def admin(authorization: Annotated[str | None, Header()] = None) -> None:
    expected = os.environ.get("ADMIN_TOKEN")
    if not expected:
        raise HTTPException(503, "falta configurar ADMIN_TOKEN en el servidor")
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(token, expected):
        raise HTTPException(401, "token de administrador inválido")


Admin = Annotated[None, Depends(admin)]
