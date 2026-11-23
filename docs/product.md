# Product

> Owns: what Travel Tao is for, the words we use, and the product calls that
> are deliberate. Does not own: how they're enforced (`CLAUDE.md`).

## What it is

A personal travel planner for allow-listed users (Google sign-in plus the
`allowed_emails` table). The Day Planner (`/plan`) organises trips day by day
and keeps their activities in Neon Postgres.

The landing page at `/` introduces the planner.

## The wireframes

`scratch/Itinerary-Wireframes.pdf` (untracked, a Canva export) has four
frames. "Frame N" is page N+1.

| Frame | Screen | Where it lives | Status |
| --- | --- | --- | --- |
| 0 | Trip header: trip name, Departure and Return dates | `/plan` | Built |
| 1 | Activity Bank: type chips filtering a grid of activities, plus "Add Activity (+)" | Dialog on `/plan/[tripId]` | Read-only + search built. No type chips, since there are no categories in the schema. |
| 2 | Itinerary Day: a day's content and a "Plan It" button | `/plan/[tripId]` | Day columns built. Plan It not started. |
| 3 | Activity Modal: an activity's content and a "Save It" button | Not built | Not started |

## Glossary

| Term | Meaning |
| --- | --- |
| **Trip** | A named journey with a start and end date, owned by one email. It has no geography: no country or city. |
| **Day** | One calendar date within a trip (`day_itineraries`). Exactly one per date, generated from the trip's dates. It can have a user-given **name**. With no name, the UI shows the date. |
| **Activity** | Something to do or somewhere to go, saved to a trip. One row is one real place, however many days it sits on. |
| **Placement** | An activity put on a day (`day_itinerary_activities`). It carries the **position** (order within that day). |
| **Unscheduled / wishlist** | An activity with no placement. This is a normal state, not missing data. |
| **Activity Bank** | The dialog listing every activity saved for a trip, placed or not. |
| **Plan It** | The planned action on a day (Frame 2) to fill or arrange it. Not designed in detail yet. |
| **Priority score** | 1–5 on an activity. Empty means *not prioritised yet*, not lowest. |
| **Area** | The neighbourhood ("Pontochō"). Not derived from the address. Empty until an AI lookup fills it. |

## Product calls that are deliberate

These look like defaults but are decisions. Don't "fix" them to match a
convention. The enforcement details are in `CLAUDE.md` → Data model.

- **One activity can sit on several days** (a two-day park ticket), and it's
  still one activity.
- **The same activity can't be on one day twice.** A morning visit and an
  evening return is one placement with a note.
- **Deleting a day** puts its activities back in the wishlist. **Deleting a
  trip** destroys its activities.
- **"Not found" and "not yours" look identical** (404), so trip ids can't be
  probed.
- **Nothing records rejection** and **there's no prompt history**, by the
  scoping in migration `0003`. Adding either back is a product decision. Read
  `0003`'s header first.
