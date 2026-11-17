# Custom components

Only custom components were brought across from the reference UI. **No shadcn, Radix or other UI library is used.** Where the reference used a Radix primitive, a plain-React replacement with the same CSS classes stands in.

## Primitives (`src/components/ui`)

| Component | Purpose |
|---|---|
| `Icon` | Hugeicons registry (`<Icon name size />`) |
| `Toast` | `toast.success/error/…` + `ToastContainer` |
| `Presence`, `ModalPortal` | Enter/exit animation and portal mounting for overlays |
| `ConfirmModal` | Confirmation dialog (`variant="warning"`) |
| `Sheet` | Side sheet (used inside the dashboard kit) |
| `M3Select` | Accessible custom select; **replaces the Radix select** |
| `RowMenu`, `FilterBar`, `Notice`, `EmptyState` | Menus, filters, inline notices, empty states |
| `Mascot`, `Motif`, `Logo`, `Preloader`, `TopProgress` | Brand and loading |

## Dashboard kit (`src/components/dashboard`)

| Component | Purpose |
|---|---|
| `Kit` | `PageWrap`, `PageHeader`, `Toolbar`, `SearchBox`, `Segmented`, `DataTable`, `Sheet`, `Field`, `SectionCard`, `PillChip`, `KvGrid`, `ResponsiveSelect` (wraps `M3Select`) |
| `OverviewKit` | `Hero`, `QuickLinks`, `Panel` (client components) |
| `StatGrid` | Server-renderable stat tiles and the labelled `ComingSoon` placeholders |
| `EntityManager` | Generic list + create/edit sheet + archive confirm used by all academic CRUD pages |
| `Forms`, `ReportKit` | Form and report helpers |

## Layout (`src/components/layout`)

`Shell` (workspace frame), `Sidebar`, `MobileBottomNav`, `Header`, `CommandPalette`, `AccountDialog`, `NotificationBell`, `ResponsiveTables`, `StatusPage`, `AuthShell` (login layout), `Portal` (server wrapper: authenticates, then renders the shell for a role).

## Feature components

| Component | Where |
|---|---|
| `QrScanner`, `SmartIdLogin`, `AdminLoginForm` | `components/smart-id`, camera scanning with image-upload fallback |
| `IdCard`, `CardSheet` | Printable card and the print/PDF sheet shown at issue time |
| `TimetableBuilder` | `features/timetable`, weekly grid with class/teacher/classroom views |
| `StudentsManager`, `TeachersManager` | `features/people`, CSV import/export, card issue on create |
| `SmartIdManager`, `DevicesManager` | `features/smart-id` |
| `ScheduleView`, `WeekPage` | `features/schedule`, today and weekly timetable |
