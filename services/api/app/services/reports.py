"""Reportes de visitantes (#174): afluencia y recomendación.

Cuánto vale cada uno sale de docs/design/señales-del-agente.md (#166):
- afluencia: un reporte vale 45 minutos; después vuelve a contar el patrón de la franja;
- recomendación: 90 días, y se menciona a partir de 3;
- la espera sale de la afluencia reportada: no hay reporte de espera en minutos todavía.

PROTO: los reportes viven en memoria y se pierden al reiniciar la API. Como son anónimos, no se
puede saber si dos recomendaciones vienen de la misma persona: cada una cuenta como un visitante.
"""

from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from threading import Lock

from app.models.reports import ReportKind
from app.models.world import Crowd

CROWD_MINUTES = 45
RECOMMENDATION_DAYS = 90
# PROTO: espera que se deriva de la afluencia (#166: baja 0–5, media 5–15, alta 15–30 min).
WAIT_BY_CROWD: dict[Crowd, int] = {"baja": 3, "media": 10, "alta": 20}
# Tope para que la memoria no crezca sin límite: se van los más viejos.
MAX_REPORTS = 2000


@dataclass(frozen=True)
class LiveReport:
    id: str
    target_id: str
    kind: ReportKind
    value: str | None
    at: datetime

    @property
    def expires_at(self) -> datetime:
        if self.kind == "crowd":
            return self.at + timedelta(minutes=CROWD_MINUTES)
        return self.at + timedelta(days=RECOMMENDATION_DAYS)

    def counts_at(self, moment: datetime) -> bool:
        """Cuenta desde que se hizo y hasta que caduca; antes de hacerse, todavía no existe."""
        return self.at <= moment <= self.expires_at


_lock = Lock()
_reports: deque[LiveReport] = deque(maxlen=MAX_REPORTS)
_counter = 0


def add(target_id: str, kind: ReportKind, value: str | None, moment: datetime) -> LiveReport:
    global _counter
    with _lock:
        _counter += 1
        report = LiveReport(
            id=f"reporte-{_counter}", target_id=target_id, kind=kind, value=value, at=moment
        )
        _reports.append(report)
        return report


def live_crowd(target_id: str, moment: datetime) -> LiveReport | None:
    """El reporte de afluencia vigente a esa hora: el de hora más reciente.

    Si dos tienen la misma hora, gana el último en llegar (`_reports` guarda el orden de llegada).
    """
    with _lock:
        valid = [
            (arrival, r)
            for arrival, r in enumerate(_reports)
            if r.kind == "crowd" and r.target_id == target_id and r.counts_at(moment)
        ]
    if not valid:
        return None
    return max(valid, key=lambda pair: (pair[1].at, pair[0]))[1]


def recommendations(target_id: str, moment: datetime) -> list[LiveReport]:
    with _lock:
        return [
            r
            for r in _reports
            if r.kind == "recommend" and r.target_id == target_id and r.counts_at(moment)
        ]


def reset() -> None:
    """Solo para pruebas."""
    global _counter
    with _lock:
        _reports.clear()
        _counter = 0
