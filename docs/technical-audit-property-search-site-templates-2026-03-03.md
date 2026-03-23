# Technical Audit - Property Search and Site Templates

Date: 2026-03-03
Scope: Phase 0 audit before implementation

## 1. Current Data Model Touchpoints

### 1.1 `properties` table

Primary source:

- `supabase/schema.sql`

Current shape:

- `public_code`
- `title`
- `description`
- `price`
- `type`
- `status`
- `features` JSONB
- `address` JSONB
- `images`
- `image_paths`
- `hide_from_site`
- `broker_id`

Current constraints:

- `type` and `status` are free text in the table shape (semantic constraints are enforced mostly in app code)
- `features` and `address` are already flexible JSONB extension points

Implementation impact:

- Lean package can be added without replacing the table
- The fastest path is to extend either:
  - top-level columns for first-class filters, or
  - `features` / `address` / new JSONB operational fields
- Search performance and filter ergonomics will be better if high-frequency operational fields become first-class indexed columns

### 1.2 `site_settings.theme`

Primary source:

- `supabase/schema.sql`

Current allowed values:

- `search_first`
- `premium`

Implementation impact:

- Expanding from 2 to 5 public templates requires:
  - migration for the `theme` check constraint
  - app type expansion in TypeScript
  - admin selector expansion
  - all public theme conditionals to move beyond `isPremium`

## 2. Current Property Form Touchpoints

Primary source:

- `src/components/properties/property-form.tsx`

Current editable fields in UI:

- title
- description
- price
- type
- area
- bedrooms
- bathrooms
- address:
  - street
  - number
  - neighborhood
  - city
  - state
  - zip
  - country
  - full address
- status
- hide_from_site
- images

Current payload structure:

- `features` currently stores:
  - `bedrooms`
  - `bathrooms`
  - `area`
  - `type`
- `address` currently stores:
  - `full_address`
  - `street`
  - `number`
  - `neighborhood`
  - `city`
  - `state`
  - `zip`
  - `country`

Implementation impact:

- New first-package fields must be added in three places together:
  - `src/lib/types.ts`
  - default values in the form
  - payload serialization in `onSubmit`
- The current form already groups data conceptually; it can absorb a lean expansion without redesigning the whole component

## 3. Current Internal CRM Search Touchpoints

### 3.1 Filter UI

Primary source:

- `src/components/properties/property-filters.tsx`

Current filters:

- free-text search
- property type
- status
- site visibility
- publish quality (pending)
- minimum price
- maximum price

Behavior:

- search and price are debounced
- dropdown filters update immediately
- filter state is URL-driven

Implementation impact:

- This file is the main UI surface for adding:
  - transaction type
  - owner
  - financing
  - portal flags
  - total area range
  - built area range
  - city / neighborhood / street filters
- The current structure is simple and can be expanded with grouped or collapsible sections

### 3.2 Filter execution

Primary source:

- `src/app/(dashboard)/properties/page.tsx`

Current server-side filtering:

- `search`
- `type`
- `status`
- `siteVisibility`
- `publishQuality`
- `minPrice`
- `maxPrice`

Current logic notes:

- The page filters directly against `properties`
- `publishQuality=pending` is implemented in app code using `getPropertyPublishIssues(...)`
- No current server-side filtering exists for:
  - address subfields
  - owner
  - financing
  - portal flags
  - total area vs built area

Implementation impact:

- The internal list page will need query expansion, not just UI expansion
- If new fields live in JSONB, filtering logic may become more complex and should be reviewed carefully for performance

## 4. Current Public Search Touchpoints

### 4.1 Public search API contract

Primary source:

- `src/lib/site.ts`

Current `siteListProperties(...)` args:

- `q`
- `city`
- `neighborhood`
- `type`
- `minPrice`
- `maxPrice`

Implementation impact:

- Public search expansion requires updating this client contract first
- The current TypeScript contract is small and clean, making it safe to extend incrementally

### 4.2 Public search UI

Primary source:

- `src/components/public/public-search-filters-instant.tsx`

Current visible public filters:

- keyword
- city
- neighborhood
- type
- min price
- max price

Implementation impact:

- The “search first + expandable additional filters” model should be implemented here
- Best path:
  - keep the current primary search visible
  - hide advanced fields behind a client-side toggle
- Candidate first-package additions:
  - transaction type
  - code-friendly primary label/UX
  - bedrooms
  - financing allowed
  - area

### 4.3 Public search SQL

Primary source:

- `supabase/schema.sql`
- `public.site_list_properties(...)`

Current behavior:

- only returns `available` properties
- excludes `hide_from_site = true`
- filters by:
  - `type`
  - price range
  - city
  - neighborhood
  - keyword against title/description/public code/external id/UUID

Current returned property card fields:

- id
- public_code
- title
- price
- type
- city
- state
- neighborhood
- thumbnail
- bedrooms
- bathrooms
- area

Implementation impact:

- Any public filter expansion requires SQL RPC changes, not only React changes
- If we want public search by transaction type, financing, bedrooms, or area ranges:
  - function signature must change
  - SQL predicates must change
  - client contract must change

## 5. Current Public Property Detail Touchpoints

Primary source:

- `src/app/s/[slug]/imovel/[id]/page.tsx`

Current displayed property details:

- title
- public code
- neighborhood/city/state
- price
- bedrooms
- bathrooms
- area
- description

Current data extraction:

- reads from `prop.features`
- assumes:
  - `bedrooms`
  - `bathrooms`
  - `area`

Implementation impact:

- If we introduce `total area` and `built area`, the detail page should stop assuming a single generic `area`
- Financing and transaction type may also become useful public signals

## 6. Current Template System Touchpoints

### 6.1 Theme type definitions

Primary source:

- `src/lib/site.ts`
- `src/components/site/site-admin.tsx`

Current theme enum:

- `search_first`
- `premium`

### 6.2 Theme selection in admin

Primary source:

- `src/components/site/site-admin.tsx`

Current behavior:

- admin can choose between:
  - `Conversao`
  - `Premium`
- UX copy already matches the desired product logic:
  - conversion = stronger search and lead speed
  - premium = stronger imagery and curation

Implementation impact:

- This is the obvious place to expand the selector from 2 to 5 templates
- The current UI already supports a card-like preview list and can scale to 5 with modest refactor

### 6.3 Theme rendering in public pages

Primary sources:

- `src/app/s/[slug]/layout.tsx`
- `src/app/s/[slug]/page.tsx`
- `src/app/s/[slug]/imovel/[id]/page.tsx`

Current rendering model:

- theme behavior is mostly driven by `isPremium = theme === "premium"`
- most public rendering is binary:
  - default search-first branch
  - premium branch

Implementation impact:

- Moving to 5 templates requires replacing binary theme branching with:
  - template family branching, or
  - configuration-driven layout composition
- The safest path is not to multiply `if theme === ...` blocks everywhere
- Prefer extracting:
  - shared search section
  - shared hero variations
  - shared highlight blocks
  - shared detail shell variants

## 7. Current Portal Publishing Touchpoints

### 7.1 Public portal feeds

Primary sources:

- `src/app/api/public/s/[slug]/zap-xml/route.ts`
- `src/app/api/public/s/[slug]/imovelweb-xml/route.ts`

Current feed property inclusion rule:

- organization match
- `status = available`
- `hide_from_site = false`

Current limitation:

- there is no per-property portal publish flag in feed filtering today
- if a property is public and available, it is eligible for feed output

Implementation impact:

- Adding portal flags (`imovelweb`, `zap`, `olx`) requires feed-level property filtering changes
- This affects both:
  - API route filtering
  - possibly future feed test/report logic

### 7.2 Portal XML mappers

Primary sources:

- `src/lib/integrations/zap-mapper.ts`
- `src/lib/integrations/imovelweb-mapper.ts`

Current limitations:

- ZAP transaction type is effectively hardcoded as sale
- Imovelweb `Finalidade` is hardcoded as `Venda`
- Both mappers mostly use:
  - title
  - description
  - price
  - type
  - features
  - address

Implementation impact:

- If `transaction type` becomes a first-class field, both mappers should consume it
- The new first package can immediately improve feed correctness without a full integration redesign

## 8. Recommended Technical Strategy

### 8.1 Data strategy

Recommended for the first package:

- use first-class columns for high-frequency search and publishing controls:
  - transaction type
  - purpose
  - financing allowed
  - publish_to_portals
- use `features` for structured measurement and property-specific counts:
  - total area
  - built area
  - bedrooms
  - bathrooms
- use `address` for location search fields already aligned with current design:
  - street
  - city
  - neighborhood
- use either:
  - an owner reference column, or
  - a searchable owner name cache

This keeps the current model flexible while avoiding overloading JSONB for the most common operational filters.

### 8.2 Template strategy

Recommended for the first package:

- expand `theme` from 2 to 5 enum values
- avoid binary `isPremium` logic expansion
- introduce shared template families through extracted sections/components
- keep one data/search engine underneath

### 8.3 Search strategy

Recommended for the first package:

- internal CRM search remains direct table querying in the page layer for now
- public search remains RPC-based and should be extended carefully
- do not try to unify both search paths in the same refactor

## 9. Implementation Touchpoint Checklist

The first implementation slices should touch these areas:

1. `supabase/schema.sql` and a new migration for property + site theme updates
2. `src/lib/types.ts`
3. `src/components/properties/property-form.tsx`
4. `src/components/properties/property-filters.tsx`
5. `src/app/(dashboard)/properties/page.tsx`
6. `src/lib/site.ts`
7. `supabase` RPC definitions for `site_list_properties` and `site_get_property`
8. `src/components/public/public-search-filters-instant.tsx`
9. `src/app/s/[slug]/page.tsx`
10. `src/app/s/[slug]/imovel/[id]/page.tsx`
11. `src/components/site/site-admin.tsx`
12. portal feed routes and XML mappers

## 10. Main Risks to Control During Coding

- expanding data shape without updating all dependent renderers
- adding public filters in React without updating the RPC signature
- adding portal flags in the form but forgetting feed filtering
- turning 2 themes into 5 with scattered conditional branches
- storing core operational filters only inside JSONB and creating awkward, slow query logic

## 11. Practical Conclusion

The codebase is in a good position for this feature set:

- property data is already semi-structured
- internal filters are simple but extendable
- public search is isolated behind an RPC contract
- the template system already exists conceptually, but is currently only a two-mode branch

This means the feature can be implemented incrementally without a large architectural rewrite, as long as:

- data fields are introduced intentionally
- search contracts are updated in lockstep
- template rendering is refactored before multiplying theme branches
