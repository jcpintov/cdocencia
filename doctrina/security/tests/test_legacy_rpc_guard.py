"""Static authorization checks for SQL RPC definitions, using synthetic fixtures only.

This is a guardrail, not a substitute for database permissions or runtime tests.
Run: python -m unittest discover -s doctrina/security/tests -v
"""
import re
import unittest


def _sql_without_comments_and_strings(definition: str) -> str:
    return re.sub(r"/\*.*?\*/|--[^\n]*|'(?:''|[^'])*'", " ", definition, flags=re.DOTALL).lower()


def _explicit_uid_equality(sql: str, parameter: str) -> bool:
    uid = r"auth\s*\.\s*uid\s*\(\s*\)"
    name = rf"\b{re.escape(parameter)}\b"
    return bool(re.search(rf"(?:{uid}\s*=\s*{name}|{name}\s*=\s*{uid})", sql))


def findings(definition: str):
    sql = _sql_without_comments_and_strings(definition)
    result = []
    privileged = "security definer" in sql
    if privileged and "set search_path" not in sql:
        result.append("missing_search_path")
    client_ids = [p for p in ("p_admin_id", "p_usuario_id") if re.search(rf"\b{p}\b", sql)]
    if privileged and client_ids and not all(_explicit_uid_equality(sql, p) for p in client_ids):
        result.append("client_id_without_auth_binding")
    if "update public.usuarios" in sql and "clave_hash" in sql:
        if not any(_explicit_uid_equality(sql, p) for p in client_ids):
            result.append("password_update_without_auth_binding")
    return result

class AuthorizationGuardTests(unittest.TestCase):
    def test_rejects_admin_id_only(self):
        sql = """create function public.admin_x(p_admin_id uuid) returns bool
        language plpgsql security definer set search_path to 'public'
        as $$ begin select es_admin from public.usuarios where id=p_admin_id; return true; end $$;"""
        self.assertIn("client_id_without_auth_binding", findings(sql))

    def test_rejects_password_update_by_client_id(self):
        sql = """create function public.change_x(p_usuario_id uuid) returns bool
        language plpgsql security definer set search_path to 'public'
        as $$ begin update public.usuarios set clave_hash='synthetic' where id=p_usuario_id; return true; end $$;"""
        self.assertIn("password_update_without_auth_binding", findings(sql))

    def test_flags_missing_search_path(self):
        self.assertIn("missing_search_path", findings("create function x() security definer as $$ select 1 $$;"))

    def test_server_bound_id_is_not_flagged_by_heuristic(self):
        sql = """create function public.safe_x(p_admin_id uuid) security definer
        set search_path to '' as $$ select auth.uid() = p_admin_id $$;"""
        self.assertEqual(findings(sql), [])

    def test_unrelated_uid_call_is_not_authorization(self):
        sql = "create function x(p_admin_id uuid) security definer set search_path to '' as $ perform auth.uid(); select p_admin_id $;"
        self.assertIn("client_id_without_auth_binding", findings(sql))

    def test_uid_in_comment_is_not_authorization(self):
        sql = "create function x(p_admin_id uuid) security definer set search_path to '' as $ -- auth.uid() = p_admin_id\nselect p_admin_id $;"
        self.assertIn("client_id_without_auth_binding", findings(sql))

    def test_uid_in_string_is_not_authorization(self):
        sql = "create function x(p_admin_id uuid) security definer set search_path to '' as $ raise notice 'auth.uid() = p_admin_id'; $;"
        self.assertIn("client_id_without_auth_binding", findings(sql))

    def test_reversed_uid_equality(self):
        sql = "create function x(p_admin_id uuid) security definer set search_path to '' as $ select p_admin_id = auth.uid() $;"
        self.assertEqual(findings(sql), [])

    def test_second_identifier_requires_binding(self):
        sql = "create function x(p_admin_id uuid, p_usuario_id uuid) security definer set search_path to '' as $ select auth.uid() = p_admin_id and p_usuario_id is not null $;"
        self.assertIn("client_id_without_auth_binding", findings(sql))

    def test_no_client_id_no_password_update(self):
        self.assertEqual(findings("create function x() security invoker as $$ select 1 $$;"), [])


if __name__ == '__main__':
    unittest.main()
