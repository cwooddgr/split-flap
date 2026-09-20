#!/usr/bin/env python3
"""Check firestore.rules against a table of allow/deny cases.

Uses Google's stateless rules-test endpoint (firebaserules projects:test), so it
needs no emulator and no Java, writes nothing, and never touches live data. It
does need `gcloud auth login` as someone who can read the project's rules.

    python3 tests/rules_test.py                  # tests ./firestore.rules
    python3 tests/rules_test.py path/to/rules    # tests another file

What it cannot do: simulate a live listener or a collection query. The `list`
case below only checks that a list request on the collection path is denied.
"""
import json, subprocess, sys, urllib.error, urllib.request

PROJECT = "split-flap-ff40a"
RULES = sys.argv[1] if len(sys.argv) > 1 else "firestore.rules"
NOW = "2026-09-20T15:00:00Z"
IN_7_DAYS = "2026-09-27T15:00:00Z"
IN_31_DAYS = "2026-10-21T15:00:00Z"
ROOM = "/databases/(default)/documents/rooms/ABC123"
USER = {"uid": "anon1"}
GOOD = {"text": "HELLO WORLD", "source": "manual", "updatedAt": NOW, "expiresAt": IN_7_DAYS}


def case(name, expect, method, data=None, existing=None, auth=USER, path=ROOM):
    request = {"path": path, "method": method, "time": NOW}
    if auth:
        request["auth"] = auth
    if data is not None:
        request["resource"] = {"data": data}
    test = {"expectation": expect, "request": request}
    if existing is not None:
        test["resource"] = {"data": existing}
    return name, test


def without(d, key):
    return {k: v for k, v in d.items() if k != key}


CASES = [
    # Reads
    case("signed-in get", "ALLOW", "get", existing=GOOD),
    case("get of a room that doesn't exist yet", "ALLOW", "get"),
    case("get without auth", "DENY", "get", existing=GOOD, auth=None),
    case("get with a lowercase room id", "DENY", "get", path=ROOM.replace("ABC123", "abc123")),
    case("get with a 3-character room id", "DENY", "get", path=ROOM.replace("ABC123", "ABC")),
    case("list the rooms collection", "DENY", "list", path="/databases/(default)/documents/rooms"),
    case("list addressed at one room", "DENY", "list", existing=GOOD),
    # Writes the web remote makes
    case("create, the shape control.js writes", "ALLOW", "create", data=GOOD),
    case("update of an existing room (merged result)", "ALLOW", "update", data=dict(GOOD, text="NEW"), existing=GOOD),
    case("clear button (empty text)", "ALLOW", "update", data=dict(GOOD, text="", source="clear"), existing=GOOD),
    case("holiday source key", "ALLOW", "create", data=dict(GOOD, source="thanksgiving")),
    case("text and expiresAt only", "ALLOW", "create", data={"text": "HI", "expiresAt": IN_7_DAYS}),
    case("1,000-character text", "ALLOW", "create", data=dict(GOOD, text="A" * 1000)),
    case("update that adds expiresAt to an old room without one", "ALLOW", "update",
         data=GOOD, existing={"text": "OLD"}),
    # Writes that must fail
    case("create without auth", "DENY", "create", data=GOOD, auth=None),
    case("create with a bad room id", "DENY", "create", data=GOOD, path=ROOM.replace("ABC123", "abc-123")),
    case("no expiresAt (TTL could never clean it up)", "DENY", "create", data=without(GOOD, "expiresAt")),
    case("expiresAt 31 days out", "DENY", "create", data=dict(GOOD, expiresAt=IN_31_DAYS)),
    case("expiresAt not a timestamp", "DENY", "create", data=dict(GOOD, expiresAt="never")),
    case("extra field", "DENY", "create", data=dict(GOOD, payload="x" * 100)),
    case("update that sneaks in an extra field", "DENY", "update", data=dict(GOOD, junk=1), existing=GOOD),
    case("no text", "DENY", "create", data=without(GOOD, "text")),
    case("text not a string", "DENY", "create", data=dict(GOOD, text=42)),
    case("1,001-character text", "DENY", "create", data=dict(GOOD, text="A" * 1001)),
    case("source not a string", "DENY", "create", data=dict(GOOD, source=7)),
    case("33-character source", "DENY", "create", data=dict(GOOD, source="s" * 33)),
    case("updatedAt not a timestamp", "DENY", "create", data=dict(GOOD, updatedAt="yesterday")),
    case("delete", "DENY", "delete", existing=GOOD),
    # Everything else
    case("get outside rooms", "DENY", "get", path="/databases/(default)/documents/users/u1"),
    case("write outside rooms", "DENY", "create", data=GOOD, path="/databases/(default)/documents/users/u1"),
    case("write under a room", "DENY", "create", data=GOOD, path=ROOM + "/messages/m1"),
]


def main():
    token = subprocess.check_output(["gcloud", "auth", "print-access-token"]).decode().strip()
    body = {
        "source": {"files": [{"name": "firestore.rules", "content": open(RULES).read()}]},
        "testSuite": {"testCases": [test for _, test in CASES]},
    }
    req = urllib.request.Request(
        f"https://firebaserules.googleapis.com/v1/projects/{PROJECT}:test",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "x-goog-user-project": PROJECT,
                 "Content-Type": "application/json"},
    )
    try:
        out = json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:800]}")

    errors = [i for i in out.get("issues", []) if i.get("severity") == "ERROR"]
    for issue in out.get("issues", []):
        pos = issue.get("sourcePosition", {})
        print(f"  {issue.get('severity')}: line {pos.get('line')}: {issue.get('description')}")
    if errors:
        sys.exit(f"{RULES} does not compile")

    results = out.get("testResults", [])
    failed = 0
    for (name, test), result in zip(CASES, results):
        ok = result.get("state") == "SUCCESS"
        failed += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {test['expectation']:5} {name}")
        if not ok:
            for msg in result.get("debugMessages", []):
                print(f"       {msg}")
    print(f"\n{RULES}: {len(results) - failed} of {len(results)} cases pass")
    sys.exit(1 if failed or len(results) != len(CASES) else 0)


if __name__ == "__main__":
    main()
