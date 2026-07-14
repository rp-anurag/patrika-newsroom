# SSO: Patrika Newsroom → editorialreview.patrika.com

The newsroom sidebar has an **Editorial Review** button. It opens:

```
https://editorialreview.patrika.com/login.html#pk_sso=<newsroom-jwt>
```

The token travels in the URL **hash** (never sent to any server or logged) and is
verified against the newsroom API. Add the snippet below to `login.html` on
editorialreview.patrika.com — when a valid token is present the page skips the
login form and starts a session automatically.

## Snippet for login.html

```html
<script>
(function () {
  // Newsroom API base — must be reachable from the user's browser.
  var NEWSROOM_API = 'http://<newsroom-host>:3000/api';   // <-- set the real host

  var m = location.hash.match(/pk_sso=([^&]+)/);
  if (!m) return;                       // no SSO token → normal login form
  var token = decodeURIComponent(m[1]);
  history.replaceState(null, '', location.pathname);   // scrub token from URL

  fetch(NEWSROOM_API + '/auth/sso-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.valid) return;             // invalid/expired → show login form
      // d.user = { username, role, state, branch, ... }
      // ── Adapt this part to however editorialreview stores its session ──
      sessionStorage.setItem('er_user', JSON.stringify(d.user));
      location.href = '/index.html';    // or the app's dashboard page
    })
    .catch(function () { /* newsroom unreachable → normal login */ });
})();
</script>
```

## Notes

- Verification endpoint: `POST /api/auth/sso-verify` with body `{ "token": "..." }`.
  Returns `{ valid: true, user: {...} }` or HTTP 401 `{ valid: false }`.
- CORS on the newsroom API is open (`Access-Control-Allow-Origin: *`), so the
  browser call works from editorialreview.patrika.com.
- Tokens expire 24 h after newsroom login; an expired token simply falls back
  to the normal login form.
- The `<newsroom-host>` must be a URL the user's browser can reach (LAN IP or
  public hostname of the newsroom server — `localhost` only works on the same machine).
