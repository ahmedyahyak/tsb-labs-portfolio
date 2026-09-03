# Case studies, source of truth

Companion to `case-studies.html`. This file holds the verified facts, the rules that
govern what may be said, and the reusable lines for outreach. Edit here first, then
the page.

House rules that apply to every line on the page:
- No em dashes or en dashes, anywhere, ever.
- Blueprint blue only. Never mix in AIFH volt, DevMate red or Madar copper.
- No invented numbers, no invented clients, no invented testimonials. A gap is
  written as a gap.
- Client names stay out until Ahmed clears each one individually.

---

## Verification log

Everything numeric on the page was measured on **23 August 2026**, not estimated.
Re verify before any future claim that the numbers are current.

| Claim | How to re verify | Result on 23 Aug 2026 |
|---|---|---|
| 451 automated checks, clean type check | `cd ~/Projects/jarvis && npm run check` | exit 0, 451 `ok` assertions across 17 suites, recounted 3 Sep 2026 |
| 47 specialist roles | `python3 -c "import json;print(len(json.load(open('roles.json'))['roles']))"` | 47 (Default 1, Commercial 15, Operating 11, Technical 11, Frontier 1, Other 8) |
| Inbound loop under 60s at $0.159 | `logs/madar-sdr.log`, round 3 entry | detect, brief email, reply email, status write, zero taps |
| Service revived in 8s | doctor kill test, recorded in project memory | revived via `kickstart` |
| Agent hired and examined in 93s | `scripts/eval-hr-hires.ts` | passed all three exam questions |
| Restore drill | `scripts/madar-backup.ts` drill mode | dump loaded into throwaway db, graph intact, live untouched |

Numbers deliberately **not** on the page:
- Luqma traction. Not captured yet. Do not publish a user count, order count or
  revenue figure until Ahmed supplies a real one with its denominator.
- Anything at all about the NDA engagement's client, sector, or money.
- Paid deployment count for Madar OS. The page says TSB Labs is deployment zero,
  which is true, and it never implies other customers exist.

---

## Case 01, Madar OS runs TSB Labs

**Who this is for:** the Founder OS buyer. A GCC owner or founder who is the
bottleneck in their own company.

**The argument in one line:** the company selling an AI operating system is run by
one, and here are the measurements.

**Why it is the strongest asset we own:** nobody else can copy it. A competitor can
copy the product claims. They cannot copy having run their own company on it for
months and kept the logs.

Honest boundary that must stay on the page: the LinkedIn co pilot prepares and
queues, and a human sends, because the platform's terms require it. This reads as a
constraint and sells as integrity. Never soften it into implying automation.

## Case 02, Luqma

**Who this is for:** a founder judging whether we can ship and operate a real
consumer product rather than a slide.

**The argument in one line:** consumer app, merchant console and operations console,
live and running, built and operated by the same house.

**Open gap:** traction. Ahmed to supply. Until then the page says plainly that we are
not publishing figures, and gives the reason, which is stronger than silence.

## Case 03, technology partner to a platform business in Oman

**Disclosure ceiling, do not exceed.** The NDA makes even the existence of the
discussion confidential. The one approved public description is the wording already
live on the portfolio card:

> technology advisor and build lead to a platform business in Oman: leading the
> development team, owning architecture and security, and delivering customer apps,
> an operations console and an encrypted data room.

The case study page stays at exactly that level. It must never mention the client
name, the sector, what the platform does, the people involved, or any figure.

**What is safe to sell, because it is our discipline and not their information:**
security as a named programme rather than a line item; residency and the controller
versus processor split settled in writing before build; infrastructure chosen on
three year total cost; supplier quotes audited line by line; acceptance defined as
demonstrations rather than deliverables.

---

## Pull quotes for outreach

Paste ready. No dashes. Each one stands alone in a LinkedIn message or a cold email.

**On being customer zero**
> We run our own company on the system we sell. Three hundred and twenty automated
> checks, four services that run unattended, and a restore drill we have actually
> executed rather than assumed.

**On the inbound lane**
> An enquiry arrives, and inside a minute it has been researched against the memory
> of the business, answered in my voice, and written back to the CRM with its status
> changed. It cost sixteen cents.

**On the honesty position**
> Some of our engagements are under confidentiality, so we describe the work rather
> than name the client. You should be suspicious of any supplier who would do
> otherwise.

**On acceptance, for a build conversation**
> We define acceptance as demonstrations, not deliverables. "The booking module is
> complete" is an argument. "A customer books, a job is completed, payment is taken"
> either works or it does not.

**On the audit habit**
> The most valuable thing we did in the first months of our last platform engagement
> was not writing code. It was reading the supplier's numbers carefully enough to
> find the arithmetic errors inside their own totals.

**On the boundary, when someone asks for LinkedIn automation**
> Our co pilot researches and drafts, then stops, because the platform's terms say a
> human sends. We write the boundary into the system rather than leaving it to
> discipline.

---

## Known drift to fix on the main portfolio page

Found 23 August 2026 while sourcing these case studies. Both are on the live public
site and both are honesty problems, which matters more for this house than for most.

1. **Role count is stale.** The Madar OS card says "thirty specialist roles". There
   are 47 in `roles.json`. Either restate it or drop the number.
2. **A parked project is shown as active.** The gym platform card reads "IN
   DELIVERY". The CRM records it as parked, pending payment received and the brand
   name plus domain being locked. Shipping a public claim that a stalled project is
   in delivery is the exact failure the rest of the page is built to avoid.
