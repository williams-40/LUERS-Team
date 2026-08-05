import pytest
from apps.reports.routing import (
    DepartmentRoutingService, KeywordRoutingStrategy, get_confidence_tier,
)
from apps.core.factories import DepartmentFactory


@pytest.mark.parametrize('confidence,expected', [
    (1.0, 'high'), (0.8, 'high'), (0.79, 'medium'), (0.5, 'medium'), (0.49, 'low'), (0.0, 'low'),
])
def test_get_confidence_tier(confidence, expected):
    assert get_confidence_tier(confidence) == expected


@pytest.mark.django_db
def test_keyword_strategy_high_confidence_match():
    DepartmentFactory(name='ICT Services')
    result = KeywordRoutingStrategy().classify(
        'My laptop was stolen along with my wifi router password and network cable'
    )
    assert result.department.name == 'ICT Services'
    assert result.confidence == 1.0
    assert get_confidence_tier(result.confidence) == 'high'
    assert set(result.matched_keywords) <= {
        'laptop', 'wifi', 'password', 'network', 'computer', 'email', 'printer', 'portal',
    }
    assert result.strategy == 'keyword'


@pytest.mark.django_db
def test_keyword_strategy_medium_confidence_match():
    # Exactly 2 keyword hits ('borrow', 'book') -> 2/3 confidence -> medium.
    # Deliberately avoids also matching 'library' itself, which would push
    # this to 3 hits (high).
    DepartmentFactory(name='Library')
    result = KeywordRoutingStrategy().classify('Can I borrow this book, please')
    assert result.department.name == 'Library'
    assert 0.5 <= result.confidence < 0.8
    assert get_confidence_tier(result.confidence) == 'medium'


@pytest.mark.django_db
def test_keyword_strategy_no_match_returns_none_department():
    result = KeywordRoutingStrategy().classify('The weather today is quite pleasant')
    assert result.department is None
    assert result.confidence == 0.0
    assert get_confidence_tier(result.confidence) == 'low'


def test_keyword_strategy_handles_empty_text():
    result = KeywordRoutingStrategy().classify('')
    assert result.department is None
    assert result.confidence == 0.0


@pytest.mark.django_db
def test_keyword_strategy_returns_none_department_when_matched_department_not_in_db():
    # Keywords match "Finance" but no such Department row exists yet.
    result = KeywordRoutingStrategy().classify('I need a refund on my tuition fee invoice payment')
    assert result.department is None
    assert result.confidence > 0  # matched keywords, just no corresponding row


@pytest.mark.django_db
def test_department_routing_service_uses_default_keyword_strategy():
    DepartmentFactory(name='Health & Safety')
    result = DepartmentRoutingService().classify('There was a fire and someone got injured')
    assert result.department.name == 'Health & Safety'


def test_department_routing_service_accepts_custom_strategy():
    class FakeStrategy:
        def classify(self, text):
            return 'fake-result'

    service = DepartmentRoutingService(strategy=FakeStrategy())
    assert service.classify('anything') == 'fake-result'
