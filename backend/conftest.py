import pytest


@pytest.fixture(autouse=True)
def _seed_roles_and_permissions(request, django_db_blocker):
    """
    pytest.ini's --nomigrations skips the whole migration graph (including
    RunPython data migrations), so the built-in Role/Permission rows that
    migration 0004 seeds for real deploys never land in the test DB on their
    own — seed them from the same shared source (apps.accounts.role_seed_data)
    instead.

    Re-seeds before every DB-marked test rather than once per session:
    apps.notifications.test_consumers.py's tests use
    @pytest.mark.django_db(transaction=True) (required for async
    database_sync_to_async writes), and Django's TransactionTestCase-style
    cleanup flushes (truncates) every table after each such test — which
    wipes out a one-time session seed the moment the first transactional
    test runs. seed()'s get_or_create calls are cheap and idempotent, so
    reseeding per test is safe.
    """
    if request.node.get_closest_marker('django_db') is None:
        yield
        return
    with django_db_blocker.unblock():
        from apps.accounts.models import Permission, Role
        from apps.accounts.role_seed_data import seed
        seed(Permission, Role)
    yield
