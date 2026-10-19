# My real incidents — dictate one per paragraph with Wispr Flow, blank line between them.
# Then: npm run seed -- --file seed/my-incidents.md

ok so the 502s after deploy thing — thought it was the load balancer, it wasn't — stale env var in the worker, restarted the worker, fixed.

Signup emails not arriving for gmail users. Thought SendGrid was down, nope. SPF record was missing the new mail provider include. Added it to DNS, delivered within the hour.
