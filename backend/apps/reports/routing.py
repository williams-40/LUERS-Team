"""
Department auto-routing for reports submitted under "Other".

Deliberately built as a swappable strategy (`RoutingStrategy` protocol +
`KeywordRoutingStrategy` as the only concrete implementation today) so a
future AI/NLP or hybrid classifier can be dropped in later without
touching `ReportService.create_report` or the confidence-tier logic here.
"""
from dataclasses import dataclass, field
from typing import Literal, Optional, Protocol

from apps.reports.models import Department

HIGH_CONFIDENCE_THRESHOLD = 0.8
MEDIUM_CONFIDENCE_THRESHOLD = 0.5

ConfidenceTier = Literal['high', 'medium', 'low']


@dataclass
class RoutingResult:
    department: Optional[Department]
    confidence: float
    strategy: str
    matched_keywords: list = field(default_factory=list)
    explanation: str = ''


class RoutingStrategy(Protocol):
    def classify(self, text: str) -> RoutingResult: ...


def get_confidence_tier(confidence: float) -> ConfidenceTier:
    if confidence >= HIGH_CONFIDENCE_THRESHOLD:
        return 'high'
    if confidence >= MEDIUM_CONFIDENCE_THRESHOLD:
        return 'medium'
    return 'low'


# Department name -> keywords considered indicative of that department.
# Not NLP/AI on purpose (matches this project's existing "no AI yet"
# stance) — a real classifier can replace KeywordRoutingStrategy alone.
DEPARTMENT_KEYWORDS = {
    'Security': ['theft', 'stolen', 'robbery', 'assault', 'fight', 'break-in', 'burglary', 'suspicious'],
    'ICT Services': ['computer', 'laptop', 'wifi', 'internet', 'network', 'password', 'email', 'printer', 'portal'],
    'Academic Affairs': ['exam', 'grade', 'grades', 'lecturer', 'course', 'academic', 'cheating', 'plagiarism', 'transcript'],
    'Student Affairs': ['accommodation', 'hostel', 'welfare', 'counseling', 'bursary', 'roommate'],
    'Finance': ['fee', 'fees', 'tuition', 'refund', 'invoice', 'payment', 'scholarship', 'salary'],
    'Health & Safety': ['medical', 'injury', 'injured', 'collapsed', 'fire', 'accident', 'hazard', 'ambulance'],
    'Estates / Maintenance': ['plumbing', 'electrical', 'leak', 'broken', 'maintenance', 'repair', 'furniture'],
    'Library': ['book', 'library', 'overdue', 'borrow', 'librarian'],
    'Human Resources': ['harassment', 'payroll', 'employment', 'misconduct'],
}


class KeywordRoutingStrategy:
    """
    Confidence = distinct matched keywords for the best-matching
    department, scaled to [0, 1] (3+ hits = full confidence).
    """
    MAX_HITS_FOR_FULL_CONFIDENCE = 3

    def classify(self, text: str) -> RoutingResult:
        haystack = (text or '').lower()
        best_department_name = None
        best_matches = []

        for department_name, keywords in DEPARTMENT_KEYWORDS.items():
            matches = [kw for kw in keywords if kw in haystack]
            if len(matches) > len(best_matches):
                best_department_name = department_name
                best_matches = matches

        if not best_matches:
            return RoutingResult(
                department=None,
                confidence=0.0,
                strategy='keyword',
                matched_keywords=[],
                explanation='No keyword matches found.',
            )

        confidence = min(1.0, len(best_matches) / self.MAX_HITS_FOR_FULL_CONFIDENCE)
        department = Department.objects.filter(name=best_department_name).first()
        explanation = f"Matched {len(best_matches)} keyword(s) for {best_department_name}: {', '.join(best_matches)}"
        return RoutingResult(
            department=department,
            confidence=confidence,
            strategy='keyword',
            matched_keywords=best_matches,
            explanation=explanation,
        )


class DepartmentRoutingService:
    """Facade over the configured routing strategy (keyword-based by default)."""

    def __init__(self, strategy: Optional[RoutingStrategy] = None):
        self.strategy = strategy or KeywordRoutingStrategy()

    def classify(self, text: str) -> RoutingResult:
        return self.strategy.classify(text)
