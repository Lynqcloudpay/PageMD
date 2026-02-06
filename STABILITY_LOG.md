# Stability Log

This log tracks stable git tags and the state of the application at those points.

## stable-sales-admin-v1
**Date:** 2026-02-05
**Tag:** `stable-sales-admin-v1`
**Description:**
- **Sales Admin UI/UX**: Validated and working.
- **Schedule Visibility**: Sellers see ONLY their own appointments ("My Schedule"). Admins see "Team Schedule".
- **Global Pipeline**: Admins can filter pipeline by user.
- **Backend Access**: `/master-schedule` endpoint correctly filters data for non-admins transparently.
- **Fixes**: Resolved 502 Bad Gateway issue and Old UI caching issue.

**Restore Command:**
```bash
git checkout stable-sales-admin-v1
```
