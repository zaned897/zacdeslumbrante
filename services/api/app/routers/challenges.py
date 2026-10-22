from fastapi import APIRouter

from app.models.challenges import ChallengeList
from app.services.challenges import list_challenges

router = APIRouter(tags=["challenges"])


@router.get("/challenges", response_model=ChallengeList, response_model_by_alias=True)
def get_challenges() -> ChallengeList:
    return ChallengeList(challenges=list_challenges())
