# How to work in this repository

The web app lives in `webapp/` (Netlify site senate-board). `data/` is the relay's snapshot data: never edit it by hand.

## Before building anything Navin asks for

1. Say in one line what the person opening the page wants at that moment (e.g. after Election Day: who won and who called it), and check the whole page against that, not only the part named in the request.
2. Name what else the request makes stale, and fix it in the same pass or say why not.
3. Walk through the first phone screen as a first-time visitor before shipping; test that it makes sense, not only that it works.
4. Keep the fix proportionate: if friends will open the site once or twice, do not spend an hour on a redesign.

Netlify deploys from `webapp/` on every push to `main`; confirm the deploy with the Netlify connector and say which commit is live.
