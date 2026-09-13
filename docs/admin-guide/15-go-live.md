# 15. Go-live checklist


## Go-live checklist

- [ ] Deployment green on the target machine (`DEPLOY_*.md` verify steps pass)
- [ ] All §11 hardening items done
- [ ] Org/Locale/Billing/Late-fee/Alerts configured; currency final
- [ ] Properties → buildings → floors → rooms → beds entered
- [ ] Real users + roles + property assignments; demo accounts disabled
- [ ] Opening balances posted (if migrating); payment methods + secrets set
- [ ] Owners + contracts + payout methods; Telegram linked + test message received
- [ ] All §9 jobs scheduled and **test-fired once** (check audit rows)
- [ ] Nightly backup scheduled + one test restore completed
- [ ] Staff trained on golden path: lease → invoice → QR/cash payment → receipt → move-out settlement (`manual/13` + `manual/14`)
- [ ] Printed: admin contact list, backup/restore one-pager, incident process

---

*End of Administrator Guide. Keep this file next to the deployment guides and
review it after every major update.*
