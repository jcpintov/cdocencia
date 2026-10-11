"""Static authorization checks for SQL RPC definitions, using synthetic fixtures only.

This is a guardrail, not a substitute for database permissions or runtime tests.
Run: python -m unittest discover -s doctrina/security/tests -v
"""
import re
import unittest


def findings(definition: str):
    sql = re.sub(r"--[^\n]*", "", definition).lower()
    result = []
    if "security definer" in sql and "set search_path" not in sql:
        result.append("missing_search_path")
    if "security definer" in sql and re.search(r"\b(p_admin_id|p_usuario_id)\b", sql):
        if "auth.uid()" not in sql and "auth.jwt()" not in sql:
            result.append("client_id_without_auth_binding")
    if "update public.usuarios" in sql and "clave_hash" in sql:
        if "auth.uid()" not in sql and "auth.jwt()" not in sql:
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

    def test_no_client_id_no_password_update(self):
        self.assertEqual(findings("create function x() security invoker as $$ select 1 $$;"), [])


if __name__ == '__main__':
    unittest.main()
