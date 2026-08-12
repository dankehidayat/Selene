# Selene Hotfix Round 3 — Execution Plan

Status: APPROVED by user (m0347 "Execute the plan"), BLOCKED on plan-mode lock. Resume in build mode.

## User-approved decisions
1. Compact day/month/year dropdown picker for ALL pages (replaces calendar grid everywhere).
2. Admins may change other users' roles BOTH directions (USER↔ADMIN). Self-elevation keeps MFA.
3. Chart animation on desktop only (>=1024px), respecting prefers-reduced-motion.

## Root causes (verified in code)
- **Admin role 400**: `apps/backend/src/routes/admin.ts` L154 `required: ["role","totpCode","confirmationCode"]`; frontend sends only `{role}`. L176 hard-blocks `role:"USER"` requests.
- **Climate shade covers x-axis**: `TimeSeriesChart` AreaLayer fills to `yScale(0)`; when domain min>0 that lies below the plot → overflow paints over bottom axis labels.
- **No animation**: `animate:false` hardcoded (mobile-perf fix).
- **Sidebar asymmetry**: compact mode keeps per-section `pb-4`/`space-y` leftovers.
- **Data Log export "borked"**: two full CalendarPicker month grids stuffed in a 280px popover.
- **ESP32 offline**: broker healthy (ingestor+backend connected as selene/selene123; port 1883 public) → device-side reconnect exhaustion; needs power-cycle. NOT a repo bug.

## Tasks (exact edits)

### 1. Backend `apps/backend/src/routes/admin.ts`
- Schema: `required: ["role"]`; totpCode/confirmationCode optional (keep property defs).
- Handler top:
  - Remove unconditional "Role downgrades prohibited" guard (L175–180).
  - Add: `if (id === req.userId && role !== "ADMIN")` → 403 "You cannot change your own role to USER".
  - In self-elevation branch start: `if (!totpCode || !confirmationCode)` → 400 "totpCode and confirmationCode are required for self-elevation".
  - Body type: totpCode?/confirmationCode? optional.
- Admin-manages-other branch (L423+) unchanged → now works both directions.
- Verify: `bun build src/index.ts --target=node`.

### 2. `charts/TimeSeriesChart.tsx` area baseline clamp
- In AreaLayer: replace `ys(0)` baseline with `Math.min(ys(0), innerHeight)` (layer props include innerHeight).

### 3. Animation hook `hooks/useChartAnimation.ts` (new)
```ts
export function useChartAnimation(): boolean {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAnimate(mq.matches && !rm.matches);
    update();
    mq.addEventListener("change", update); rm.addEventListener("change", update);
    return () => { mq.removeEventListener("change", update); rm.removeEventListener("change", update); };
  }, []);
  return animate;
}
```
- Wire `animate={useChartAnimation()}` in TimeSeriesChart, NivoBarChart, NivoPieChart, NivoScatterChart.

### 4. RangeFilter rebuild — compact day/month/year picker
File: `src/components/RangeFilter.tsx` (full rewrite, keep `{from,to,onChange,emptyLabel}` API).
- Trigger button: CalendarDays icon + label (emptyLabel when null; else "13 Aug 2026 – 14 Aug 2026"; same-date + time shows times).
- Popover (bottom-sheet on mobile via existing isMobile logic):
  - For From and To each: label row + collapsible section containing 3 selects:
    Day (1..31), Month (January..December), Year (dataMin-1 .. currentYear; use 2024..now).
    Each select styled like existing controlBtnClass selects, icons: CalendarDays before date group, Clock before time.
  - When From date == To date: show two time selects (HH:MM) with Clock icons.
  - Apply / Reset buttons (Reset → onChange(null,null)).
- Export reusable `DateFields` (day/month/year selects row) for DataLog export-by-range.
- Remove: month-grid CalendarPicker, Today chip, grid CSS. Keep helpers (toLocalDateString etc).

### 5. DataLog export popover
- Replace the two `<CalendarPicker>` instances with the new compact `DateFields` rows (From/To day-month-year selects).
- Keep "Export all" section + ranged CSV/TSV buttons + ISO conversion logic (already correct).

### 6. Sidebar compact spacing
`src/components/Sidebar.tsx`: in compact mode render ONE continuous `<nav className="px-2 flex flex-col items-center gap-1">` containing ALL items (main + admin + info), no per-group pb-4; optional hairline `<div className="w-6 border-t my-1 ...">` dividers between groups. Keep tooltips/title attrs.

### 7. ESP32 handoff (no code)
Instructions for user:
- Power-cycle the ESP32 (its MQTT retry gave up during the ~5-day outage).
- Verify after reboot: EMQX dashboard should show a 3rd client; `docker logs selene-emqx --tail 50 | grep -i "office-main\|1883\|auth"`; device data appears in Data Log within ~30s.
- If still failing: test port from another network (`nc -vz 198.7.122.114 1883`) and check the sketch's MQTT reconnect loop.

### 8. Verify & ship
- `bun run typecheck` + `bun run build` (frontend), `bun build` (backend).
- Commit + push master. Suggested message:
  `fix: admin role 400 + demotion, chart area overflow, desktop animations, compact date pickers, sidebar spacing`

## Files touched
- apps/backend/src/routes/admin.ts
- apps/frontend/src/components/charts/TimeSeriesChart.tsx
- apps/frontend/src/components/charts/NivoBarChart.tsx
- apps/frontend/src/components/charts/NivoPieChart.tsx
- apps/frontend/src/components/charts/NivoScatterChart.tsx
- apps/frontend/src/hooks/useChartAnimation.ts (new)
- apps/frontend/src/components/RangeFilter.tsx (rewrite)
- apps/frontend/src/pages/DataLog.tsx
- apps/frontend/src/components/Sidebar.tsx
