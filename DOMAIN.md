# Domains: what is actually free, and what this site should run on

Written 2026-09-03, by checking the registries and the hosts rather than recalling
them. Every claim below has a source or a command you can run.

The site currently answers on `https://tsb-labs-portfolio.vercel.app`. That host
is hardcoded in four pages of structured data, the README and `STATUS.md`.
Moving off it is one command, `node scripts/set-domain.mjs <url>`, once a domain
exists. This document is about which domain.

---

## The thing that started this: freedomains.cc

It advertises free `.com`, `.net` and `.org` registrations that "renew free for
life", obtained by completing tasks. **Do not put this site on it.**

The arithmetic does not close. A registrar pays Verisign a wholesale fee for
every `.com` year, currently around ten dollars, plus the ICANN transaction fee.
Nobody absorbs that forever for an unlimited number of strangers. When a service
says otherwise, one of three things is true:

1. It is a **subdomain**, not a domain. `yourname.theirdomain.com`, sold as if it
   were `yourname.com`.
2. The domain is registered with **them as the legal registrant** and you as a
   user of it. You cannot transfer it out, you cannot move registrar, and it
   stops resolving the day they decide it does.
3. The "free" is paid for in tasks, ads, or an upsell into paid hosting.

None of those is a foundation for `pay.html`. The failure mode is not that the
site goes down; it is that the URL on every proposal, invoice and signature
block stops working, and there is no account you can log into to fix it because
you were never the registrant.

This is not hypothetical. Freenom ran the largest free-domain business there
was, giving away `.tk`, `.ml`, `.cf` and `.gq`. Meta sued it in 2023 over abuse
volumes, ICANN pulled its registrar accreditation that November, and it left the
domain business in February 2024. Roughly **12.6 million domains stopped
resolving.** Every one of them was somebody's project URL.

Two more practical notes. The site is unreachable from this environment, the
egress proxy blocks it, so nothing here was verified against its actual terms.
And reputation scanners rate it middling rather than clean, which for a domain
you intend to send client mail from is its own problem: a shared parent domain
carries other people's spam reputation into your deliverability.

---

## What is genuinely free, and what each one actually gives you

Ranked by how much control you end up holding.

| Option | You are the registrant | Renewal | Good for |
|---|---|---|---|
| **eu.org** | Yes, a real delegated domain | Free, no expiry | A real site, if the name suits |
| **js.org**, **is-a.dev** | No, a subdomain by pull request | Free while the project lives | Demos, dev tools |
| **`*.vercel.app`** | No, Vercel's domain | Free | What you have now |
| **Cloudflare Registrar** | Yes | ~$10-11/yr, at cost | Anything client facing |

**eu.org** has given away free domains since 1996 and is the only genuinely free
option in the list where you hold a real, delegated domain with your own
nameservers and no expiry date. Requests are reviewed by hand, typically around
two weeks. The catch is the name: you get `tsblabs.eu.org`, and a European
non-profit registry's suffix on a Muscat consultancy's invoice reads as a
placeholder, not an address.

**js.org** and **is-a.dev** are pull requests against a public repository. You
add a CNAME record to a JSON file, it gets merged, your project answers on
`name.js.org`. Fast, honest about what it is, and correctly scoped: js.org wants
JavaScript projects, is-a.dev wants developers. You control where it points and
nothing else.

**Cloudflare Registrar is not free and is the recommendation anyway.** It sells
at wholesale with no markup and no first-year-cheap-then-triple pricing, which
over three years costs about the same as one hour of the work this site exists
to sell. You are the registrant. You hold the transfer code. Nobody can take it.

---

## The recommendation

Split it by what the URL has to carry.

**TSB Labs portfolio: buy the domain.** This is the site with a payments page, a
booking flow and case studies from engagements under NDA. It is the address that
goes on agreements. Spend the ten dollars a year and own it outright. Free is
the wrong optimisation on the one asset that has to still resolve in 2031.

**Madar OS demo and any throwaway: take a free subdomain.** `tsb-os-demo` is a
demo. A `*.js.org` or `*.is-a.dev` subdomain, or the `*.vercel.app` it already
has, costs nothing and risks nothing, because if it disappears you re-point it in
an afternoon and no contract references it.

**Madar OS itself: this is not a domain problem.** It answers over a Tailscale
Funnel, and Funnel only serves names inside your tailnet's `*.ts.net` domain. A
CNAME from a custom domain to a funnel hostname fails at the TLS handshake:
Tailscale presents a certificate valid for `*.ts.net`, the SNI does not match, and
the browser refuses the connection. This is by design, not a bug, and the open
feature request has been open for years. If Madar needs a custom hostname, the
swap is Cloudflare Tunnel instead of Funnel, which is also free, terminates TLS
for a domain you own, and keeps the same property of opening no inbound port.

---

## Runbook: moving this site to a domain

Once the domain exists and its nameservers are with a registrar you control.

1. **Add it in Vercel**, project settings, Domains. Add both the apex and `www`,
   and set one as primary so the other redirects. Which one is primary matters
   less than picking one and never serving both.
2. **Create the DNS records Vercel prints.** Read them off the dashboard rather
   than copying values from a document, this one included: Vercel's apex A record
   address has changed before and will again. The shape is an `A` record on the
   apex and a `CNAME` on `www` to a `vercel-dns` target.
3. **Wait for the certificate.** Vercel issues it automatically once the records
   resolve. Minutes, not hours, unless the registrar's TTL says otherwise.
4. **Flip the canonical host in this repo:**

   ```
   node scripts/set-domain.mjs https://tsblabs.example
   ```

   That rewrites `domain.json`, the `<link rel="canonical">` and `og:url` on every
   page, the JSON-LD `url`, the README and `STATUS.md`, and regenerates
   `sitemap.xml` and `robots.txt`. It leaves `ahmedyahyak.com` and every other
   external link alone. Run `node scripts/set-domain.mjs` with no argument
   afterwards to check it landed clean.
5. **Verify in the browser, not in the diff.** House rule, and it has caught more
   in this repo than any other habit. Load the new host, check the certificate,
   check that the old `.vercel.app` URL redirects rather than serving a second
   copy of the site, and check one Open Graph preview.

---

## Sources

- [Freenom halts registrations after the Meta lawsuit](https://krebsonsecurity.com/2023/03/sued-by-meta-freenom-halts-domain-registrations/), Krebs on Security
- [Freenom leaves the domain business, 12.6M domains stop resolving](https://cctld.ru/en/media/news/industry/35839/)
- [EU.org, free domain names since 1996](https://nic.eu.org/)
- [js.org](https://js.org/) and [is-a.dev](https://is-a.dev/)
- [Tailscale Funnel documentation](https://tailscale.com/docs/features/tailscale-funnel), and the [custom domain feature request](https://github.com/tailscale/tailscale/issues/11563)
- [freedomains.cc reputation check](https://www.scam-detector.com/validator/freedomains-cc-review/)
