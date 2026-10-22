# Meeting recommendation contract

All computation is local. `WCTime.recommendTimes(participants, fromMs, untilMs, durationMinutes, objective, preset)` returns up to three nonoverlapping intervals in ranked order. The first is recommended and the remaining two are alternatives. Existing `findTimes` remains available unchanged for compatibility.

Inputs: each participant has `id` (optional, defaults to zone), IANA `zone`, `hours` (`start`/`end` HH:mm and `days`, Sunday=0), `acceptableStart` and `acceptableEnd` (defaults 06:00/22:00). Defaults for work are 09:00/17:00 Monday-Friday. The horizon must be positive and at most seven elapsed days; duration is an integer from 15 through 120 minutes. UTC starts are quarter-hour aligned and in [from,until); their ends may extend beyond until. Every elapsed minute of [start,end) is evaluated, including DST changes. Overnight work belongs to the day on which the shift begins; equal boundaries mean empty hours.

Work preset uses the original work schedule. Family uses 09:00/21:00 all days. Preferred work minutes have zero penalty, even outside acceptable hours (explicit night shifts). Family preferred minutes have zero penalty only inside acceptable hours. Other acceptable minutes have penalty 20 plus circular wall-minute distance to the nearest preferred boundary divided by six. A work off-day instead has penalty 60. Outside acceptable hours has penalty 100 plus circular distance to the nearest acceptable boundary divided by six. The per-person penalty is the maximum minute penalty. Integer `penaltyUnits` store six times these values for exact parity. A person is working only if every minute falls within their original work schedule, regardless of preset.

Balanced order: avoid participant count, largest personal penalty, sum of personal penalties, negative working count, UTC start. Working hours order: negative working count, followed by that complete Balanced tuple. Pick the first ranked candidate, then skip any overlapping candidates until three remain. No work overlap still returns clearly labeled compromises. No participants returns no recommendations.

Reason is the worst minute's classification, with earliest minute breaking severity ties: working, comfortable, early, late, avoid. Preferred family time outside work is comfortable. Work off-days inside acceptable hours are comfortable. Early/late compare circular distance to preferred start/end (ties are early). Results include UTC start/end, score tuple, counts and every participant's penalty, reason, working and avoid flags, plus local start/end dates, times and UTC offset minutes. Date strings use YYYY-MM-DD and times HH:mm.

`shared/meeting-planner-golden.json` version 1 stores `{penaltyScale:6,cases:[{id,input,expected}]}`. Input uses the API names above; expected is the complete ordered result. Native implementations should compare integer scores, UTC boundaries, reasons and dated local endpoints. The fixtures cover DST changes, night shifts, fractional zones, duration boundaries, no work overlap, and sleep preferences.

Web and Windows share src/renderer. The recommendation panel retains the existing timeline and exact interval commit/share behavior. Controls include objective, preset, duration, participant membership and per-person acceptable hours. These preferences persist in localStorage, with a session fallback if storage is unavailable, and add no network requests or backend costs.

The planner defaults to Next available, with UTC starts from now through the next 48 hours. Explore date searches the selected reference-zone civil day and explicitly labels past recommendations. A stale Next result is recomputed before selection. Invalid acceptable-hour edits remove active results until corrected; leaving an invalid field restores its last valid value.

A committed meeting stores its exact participant zones. Copy text, calendar descriptions and web/desktop share links use this snapshot, even if saved clocks differ. An excluded reference city is replaced with the first included participant for export. Link imports preserve the supplied participant list.

## Recommendation presentation and interaction

Explanations use the selected candidate's full-duration participant results. Outside acceptable hours is not automatically described as overnight: custom availability can exclude daytime. Preferred working shifts may still override acceptable limits as defined above. The explanation identifies affected cities and their actual status, without claiming that every compromise is comfortable.

Alternative labels compare each person's penalty with the currently selected interval. Name who improves and who incurs a greater penalty. When no participant improves, use a neutral alternative label instead of inventing a benefit. Keep the existing maximum of two alternatives, with exact dated local ranges; do not substitute arbitrary offsets for ranked results.

A timeline selection represents one absolute UTC interval across all rows. Dragging and keyboard adjustment update every city's dated local time together, including day changes and DST transitions. The full duration remains visible. Solar surface colours describe local daylight, while separate text and graphical markers describe preferred hours and meeting suitability. Colour alone never carries suitability.

Changing the selected time must not rerun the entire recommendation search on every pointer event. Keep expensive suggestions keyed to search inputs and evaluate the selected interval separately. Visible and shareable results must match current participants, duration and availability.
