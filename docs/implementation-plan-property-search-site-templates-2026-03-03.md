# Implementation Plan - Property Search and Site Templates

Date: 2026-03-03
Status: Design validated, pending implementation

## 1. Understanding Summary

- The next product focus is property registration, property search, and public site showcase templates.
- The first package must stay lean and cover the day-to-day needs of brokers without copying the full complexity of benchmark CRMs.
- Internal CRM search must be deeper and more operational than public site search.
- Public site search must be search-first, with a short primary form and expandable additional filters.
- The first public template package should ship with 5 template families.
- Templates should share one search/listing engine and differ only in composition, emphasis, and visual hierarchy.
- New fields should only enter the first package if they clearly support registration, filtering, publishing, or presentation.

## 2. Confirmed Scope

### 2.1 Property data to add in the first package

- Commercial:
  - transaction type: `sale`, `rent`, `seasonal`
  - purpose: `residential`, `commercial`
  - property type
  - status
- Location:
  - city
  - neighborhood
  - street
- Measurements:
  - total area
  - built area
- Operations:
  - owner / capture source (searchable by owner)
  - financing allowed
- Publishing:
  - show on site
  - publish to portals
- Portal flags:
  - `imovelweb`
  - `zap`
  - `olx`

### 2.2 Internal CRM search priorities

- code
- transaction type
- property type
- status
- city
- neighborhood
- street
- owner
- financing allowed
- site visibility
- portal publishing flags
- total area range
- built area range

### 2.3 Public site search priorities

Primary visible search:

- transaction type
- property type
- city / neighborhood
- property code

Expandable "More filters":

- price range
- bedrooms
- financing allowed
- area

### 2.4 Public site templates

The first package should ship with 5 template families:

1. Search First
2. Search + Highlights
3. Editorial Showcase
4. Light Institutional + Search
5. Compact Mobile First

These are composition variants, not separate products.

## 3. Assumptions

- The current `properties` record remains the single source of truth for CRM, public site, and feed/export behavior.
- The existing property form and list should be extended incrementally rather than replaced.
- The current public site flow under `src/app/s/[slug]` remains the base for the public showcase system.
- Existing search performance must remain acceptable for small and medium broker operations.
- Portal flags can be represented as simple booleans in the first package before any deeper per-portal rule engine exists.
- Advanced classifications such as condominium, region, suite count, parking split, amenities catalog, and portal-specific payload rules are explicitly postponed.

## 4. Explicit Non-Goals for the First Package

- Reproducing the full benchmark CRM filter matrix
- Building dozens of site templates
- Creating portal-specific advanced publishing rules
- Shipping a large amenity checkbox library
- Redesigning the whole site architecture

## 5. Decision Log

### Decision 1

- Decided: first package must be lean
- Alternatives considered: full benchmark-like property model
- Why chosen: avoids bloated forms and keeps delivery focused on broker workflows

### Decision 2

- Decided: internal CRM filters are deeper than public site filters
- Alternatives considered: same filter depth everywhere
- Why chosen: brokers need operational precision; visitors need clarity and conversion

### Decision 3

- Decided: public search is search-first with expandable additional filters
- Alternatives considered: fully expanded search in the first fold
- Why chosen: preserves conversion and avoids a heavy public UI

### Decision 4

- Decided: the first package includes 5 public template families
- Alternatives considered: one template only, or many more than 5
- Why chosen: enough variation for commercial value without creating high maintenance overhead

### Decision 5

- Decided: templates share one engine and vary by composition/visual hierarchy
- Alternatives considered: independent implementations per template
- Why chosen: reduces duplication, risk, and maintenance cost

## 6. Functional Design

### 6.1 Property registration model

The property registration model should be expanded by blocks:

- commercial metadata
- structured location
- measurements
- operational metadata
- publishing metadata

Each new field must be:

- stored consistently
- visible in the registration form where it matters
- available in at least one relevant filter or display context

This prevents dead fields that only increase form size.

### 6.2 Internal CRM search model

The internal CRM should use grouped filters, with the most used filters visible first:

- identification
- commercial
- location
- operations
- publishing
- measurements

Less frequent filters can remain behind collapsible groups, but the top-of-panel flow should favor direct operational retrieval.

### 6.3 Public site search model

The public site should keep a short, high-confidence search at the top of the home page and listing pages. Additional filters should be available through an explicit expandable action.

This supports:

- faster first interaction
- better mobile usability
- clearer visual hierarchy
- fewer abandoned searches due to overload

### 6.4 Template model

The 5 templates should be implemented as configurable layout families over the same data and component base:

- shared search component
- shared listing logic
- shared property detail logic
- shared lead capture logic

Variation happens in:

- block order
- hero treatment
- prominence of highlight sections
- amount of institutional framing
- overall density

## 7. Phased Implementation Plan

### Phase 0 - Audit and Compatibility Mapping

Goal:

- map the current code and data structures that will be extended

Tasks:

- audit current property schema, form payload, list filters, and public search inputs
- map every current use of `type`, `status`, `features`, and `address`
- confirm how feeds and property detail pages consume current property fields
- identify where current data shape should be extended versus normalized

Output:

- implementation checklist with exact touchpoints

### Phase 1 - Property Data Expansion

Goal:

- add the lean first-package fields to the property model

Tasks:

- extend the property data contract
- add fields for:
  - transaction type
  - purpose
  - total area
  - built area
  - financing allowed
  - owner reference/search key
  - publish to portals
  - portal flags
- update the property form UI to expose these fields in grouped sections
- preserve backward compatibility for existing records

Acceptance intent:

- brokers can fill in the new operational/commercial data without breaking existing records

### Phase 2 - Internal CRM Search Expansion

Goal:

- make the property list useful for operational broker search

Tasks:

- extend internal property filters
- add grouped filter UX for:
  - code
  - transaction type
  - property type
  - status
  - city
  - neighborhood
  - street
  - owner
  - financing allowed
  - site visibility
  - portal flags
  - total area range
  - built area range
- keep common filters immediately accessible
- preserve current pagination and responsive behavior

Acceptance intent:

- a broker can reliably retrieve properties using operational combinations instead of only basic search

### Phase 3 - Public Search Expansion

Goal:

- improve public findability without making the showcase heavy

Tasks:

- keep a short primary search visible in the first fold
- add an expandable "More filters" section
- expose only the public-facing subset:
  - transaction type
  - property type
  - city / neighborhood
  - code
  - price range
  - bedrooms
  - financing allowed
  - area
- ensure mobile-first usability

Acceptance intent:

- visitors can search quickly and refine when needed, without the site feeling like an internal CRM filter screen

### Phase 4 - Public Template System (5 Families)

Goal:

- introduce commercial template variety without duplicating logic

Tasks:

- define a template selection model
- create 5 layout families using shared components
- vary:
  - hero/search composition
  - emphasis on highlights
  - institutional block placement
  - content density
- keep one search/list/detail engine under all templates

Acceptance intent:

- each template clearly feels distinct, while maintenance remains centralized

### Phase 5 - QA, Migration Safety, and Rollout

Goal:

- protect existing records and current tenant sites

Tasks:

- validate legacy properties with missing new fields
- confirm empty new fields do not hide existing listings unintentionally
- confirm internal filters do not break current list behavior
- confirm public search degrades gracefully when optional fields are absent
- validate all 5 template families on desktop and mobile
- validate portal flag behavior does not imply unsupported portal automation

Acceptance intent:

- the first package can roll out incrementally without breaking current customer sites or property workflows

## 8. Recommended Execution Order

1. Phase 0 - Audit and compatibility mapping
2. Phase 1 - Property data expansion
3. Phase 2 - Internal CRM search expansion
4. Phase 3 - Public search expansion
5. Phase 4 - Public template system
6. Phase 5 - QA and rollout hardening

## 9. Suggested Backlog Breakdown

Recommended implementation slices:

1. Data model and property form
2. Internal property filters
3. Public search + expandable additional filters
4. Template selection infrastructure
5. Template family 1 and 2
6. Template family 3, 4, and 5
7. Regression QA and migration safety

## 10. Exit Criteria Before Coding

Before implementation starts, the following should be treated as fixed:

- first-package field list
- internal versus public filter scope
- 5 template family definitions
- phased delivery order
- explicit non-goals

Once these remain stable, implementation can proceed incrementally.
