from fastapi import APIRouter

from app.models.collaborators import CollaboratorArea, CollaboratorList
from app.services.collaborators import list_collaborators

router = APIRouter(tags=["collaborators"])


@router.get("/colaboradores", response_model=CollaboratorList, response_model_by_alias=True)
def get_collaborators(rol: CollaboratorArea | None = None) -> CollaboratorList:
    return CollaboratorList(collaborators=list_collaborators(rol))
