from typing import Literal

from pydantic import Field

from app.models.common import CamelModel, LocalizedText

# Valores de ?rol= y de los filtros de la pestaña Equipo (#116).
CollaboratorArea = Literal["diseno", "codigo", "contenido", "datos"]
SocialNetwork = Literal["github", "instagram", "linkedin", "x", "web"]


class Social(CamelModel):
    network: SocialNetwork
    handle: str
    url: str


class Collaborator(CamelModel):
    id: str
    name: str
    initials: str
    # Fondo del avatar de iniciales, hex.
    color: str
    role: LocalizedText
    area: CollaboratorArea
    bio: LocalizedText
    contributions: list[LocalizedText]
    # Solo las redes que la persona eligió mostrar.
    socials: list[Social]
    consent: bool


class CollaboratorList(CamelModel):
    collaborators: list[Collaborator]
    mock: bool = Field(default=True, alias="_mock")
