# 5. User management SOPs

**Where:** Admin → Users (M01).

## 5.1 Onboard a new employee

1. **Users → New user** → name, **email**, temporary password.
2. Account is created with `mustChangePassword = true` → forced change on first sign-in.
3. Assign **role(s)** (least privilege; §4).
4. Assign **properties** (required for PROPERTY-scoped roles).
5. Tell them the URL + temp password; Admin+ must also enroll **2FA**.

## 5.2 Offboard someone (do all four)

1. **Disable** the user (`status = disabled`) — blocks sign-in immediately.
2. **Revoke sessions** — force sign-out on all devices.
3. **Reset 2FA** if you ever re-enable for handover (so old codes die).
4. Check **Audit Log** filtered by that actor for a final review.

## 5.3 "I forgot my password" / lost phone

- There is **no self-service email reset** in this build — an admin sets a
  temporary password (re-arms must-change).
- Lost authenticator: admin performs **2FA reset** (M27) so the user can re-enroll.

---
